import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const HANDOFF_SCHEMA = 'artifacts-v13.5/publication-handoff-v1';
export const CANONICAL_SOURCE = Object.freeze({
  repository: 'fkr-0/artifact-lab-pages',
  revision: '6e6480e0295ae2ca7a05ee11e641ed2b518aa4f6',
});
export const DEPLOYMENT_OWNER = Object.freeze({
  repository: 'fkr-0/artifact-lab-pages',
  workflow: '.github/workflows/pages.yml',
  site: 'artifacts.fkr.dev',
  provider: 'github-pages',
});

export function assertCleanTrackedStatus(status) {
  if (typeof status !== 'string') throw new TypeError('Git status must be a string.');
  const dirty = status.trim();
  if (dirty) {
    throw new Error(
      'Publication handoff requires a clean tracked working tree; commit or restore tracked changes first:\n' +
      dirty,
    );
  }
}

export function assertCanonicalSourceRevision({
  pinnedRevision,
  actualRevision,
  pinnedIsAncestor,
} = {}) {
  if (!/^[0-9a-f]{40}$/iu.test(String(pinnedRevision || ''))) {
    throw new Error('Canonical source pin must be a full 40-character Git revision.');
  }
  if (!/^[0-9a-f]{40}$/iu.test(String(actualRevision || ''))) {
    throw new Error('Canonical source checkout must resolve to a full 40-character Git revision.');
  }
  if (pinnedRevision === actualRevision) {
    return { mode: 'exact', pinnedRevision, actualRevision };
  }
  if (!pinnedIsAncestor) {
    throw new Error(
      'Canonical source checkout ' + actualRevision +
      ' is not the pinned revision or its descendant (' + pinnedRevision + ').',
    );
  }
  return { mode: 'descendant', pinnedRevision, actualRevision };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function sha256(path) {
  const contents = await readFile(path);
  return createHash('sha256').update(contents).digest('hex');
}

function requireManifestFile(manifest, path) {
  const evidence = manifest.files?.[path];
  if (!evidence || typeof evidence.sha256 !== 'string' || !Number.isFinite(evidence.bytes)) {
    throw new Error('Publication asset manifest is missing evidence for ' + path);
  }
  return evidence;
}

export async function createPublicationHandoff({
  distRoot,
  v13Commit,
  canonicalSource = CANONICAL_SOURCE,
  deploymentOwner = DEPLOYMENT_OWNER,
  generatedAt = new Date().toISOString(),
} = {}) {
  if (typeof v13Commit !== 'string' || !/^[0-9a-f]{40}$/iu.test(v13Commit)) {
    throw new Error('Publication handoff requires the full 40-character V13.5 Git commit.');
  }
  const root = resolve(distRoot);
  const catalogPath = join(root, 'catalog.json');
  const parityPath = join(root, 'parity-report.json');
  const routesPath = join(root, 'route-manifest.json');
  const assetsPath = join(root, 'asset-manifest.json');

  const [catalog, parity, routes, assets] = await Promise.all([
    readJson(catalogPath),
    readJson(parityPath),
    readJson(routesPath),
    readJson(assetsPath),
  ]);

  if (parity.summary?.expectedLocal !== 44 ||
      parity.summary?.stagedExpected !== 44 ||
      parity.summary?.missingExpected !== 0) {
    throw new Error('Publication handoff requires strict 44/44 V12 expected-local parity.');
  }
  if (catalog.summary?.total < 55 || catalog.items?.length < 55) {
    throw new Error('Publication handoff requires at least the qualified 55-item V13.5 catalog floor.');
  }

  const byId = new Map(catalog.items.map((item) => [item.id, item]));
  if (byId.has('app-hub-v12') || byId.has('app-hub-v13')) {
    throw new Error('Publication handoff refuses superseded hub self-records.');
  }
  const self = byId.get('app-hub-v13.5');
  const meme = byId.get('meme-lab');
  const revealive = byId.get('revealive');
  if (!self || self.url !== '/index.html') throw new Error('V13.5 self-record is missing or misrouted.');
  if (!meme || meme.url !== '/meme-lab/meme-lab.html') throw new Error('Meme Lab regression route is missing.');
  if (!revealive ||
      revealive.availability !== 'verified' ||
      revealive.url !== '/artifacts/revealive/0.1.0/index.html') {
    throw new Error('Pinned Revealive release is not present as a verified compiled artifact.');
  }

  const requiredAssets = [
    'index.html',
    'app.js',
    'styles.css',
    'lib/discovery.mjs',
    'lib/favorites.mjs',
    'meme-lab/meme-lab.html',
    'artifacts/revealive/0.1.0/index.html',
    'catalog.json',
    'parity-report.json',
    'route-manifest.json',
  ];
  const assetEvidence = Object.fromEntries(
    requiredAssets.map((path) => [path, requireManifestFile(assets, path)]),
  );

  const routeById = new Map(routes.entries?.map((entry) => [entry.id, entry]) || []);
  if (routeById.get('meme-lab')?.state !== 'staged') {
    throw new Error('Meme Lab route is not staged in the route manifest.');
  }
  if (routeById.get('revealive')?.state !== 'staged') {
    throw new Error('Revealive route is not staged in the route manifest.');
  }
  if (routeById.get('app-hub-v13.5')?.state !== 'staged') {
    throw new Error('V13.5 root route is not staged in the route manifest.');
  }

  const handoff = {
    schemaVersion: HANDOFF_SCHEMA,
    generatedAt,
    release: {
      product: 'Artifacts Hub V13.5',
      commit: v13Commit,
      stageRoot: 'dist',
      catalogItems: catalog.items.length,
      expectedV12Local: parity.summary.expectedLocal,
      stagedV12Local: parity.summary.stagedExpected,
      missingV12Local: parity.summary.missingExpected,
    },
    canonicalSource,
    deploymentOwner,
    catalog: {
      self: self.id,
      replaces: catalog.superset?.replaces || [],
      currentNativeAdded: catalog.superset?.currentNativeAdded || [],
      verified: catalog.summary.verified,
      provisional: catalog.summary.provisional,
      sourceOnly: catalog.summary.sourceOnly,
    },
    regressions: {
      memeLab: {
        id: meme.id,
        url: meme.url,
        sha256: assetEvidence['meme-lab/meme-lab.html'].sha256,
      },
      revealive: {
        id: revealive.id,
        url: revealive.url,
        version: revealive.version,
        sha256: assetEvidence['artifacts/revealive/0.1.0/index.html'].sha256,
        revision: revealive.deployment?.revision || revealive.git?.revision || null,
      },
    },
    rootLauncher: {
      url: '/',
      indexSha256: assetEvidence['index.html'].sha256,
      appSha256: assetEvidence['app.js'].sha256,
      stylesSha256: assetEvidence['styles.css'].sha256,
    },
    evidence: {
      assetManifestSha256: await sha256(assetsPath),
      catalogSha256: await sha256(catalogPath),
      parityReportSha256: await sha256(parityPath),
      routeManifestSha256: await sha256(routesPath),
      hashedFiles: Object.keys(assets.files || {}).length,
    },
    integration: {
      action: 'publish-qualified-stage-through-existing-owner',
      uploadDirectory: 'dist',
      separatePagesOwnerRequired: false,
      remotePublicationPerformed: false,
      note: 'This receipt qualifies a stage for the existing artifact-lab-pages Pages owner; it does not claim that deployment occurred.',
    },
  };

  await writeFile(
    join(root, 'PUBLICATION_HANDOFF.json'),
    JSON.stringify(handoff, null, 2) + '\n',
  );
  return handoff;
}
