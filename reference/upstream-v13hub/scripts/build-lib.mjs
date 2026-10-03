import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  buildRouteMatrix,
  findDeadInternalRoutes,
  reconcileCatalogForDeployment,
} from '../app-hub-v13/lib/routes.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);
export const DEFAULT_SOURCE_DIR = join(REPO_ROOT, 'app-hub-v13');
export const DEFAULT_OUTPUT_DIR = join(REPO_ROOT, 'dist');
export const DEFAULT_PEERJSLIB_ROOT = resolve(REPO_ROOT, '..', 'peerjslib');
export const REQUIRED_PEERJSLIB_REVISION = 'c25450a16c8cf48dc61a20edd04d00eebbb4fb16';
export const PEERJSLIB_SAMPLE_PREFIX = 'samples/peerjslib-lobby-share';

const PEER_SAMPLE_CACHE = new Map();

const RUNTIME_SOURCE_FILES = [
  'index.html',
  'app.js',
  'styles.css',
  'catalog.json',
  'lib/catalog.js',
  'lib/collection.js',
  'lib/discovery.js',
  'lib/navigation.js',
  'lib/policy.js',
  'lib/peer.js',
  'lib/routes.js',
  'lib/state.js',
];

const BUNDLE_BUDGET_BYTES = 500 * 1024;
const INTERACTIVE_BUDGET_MS = 3000;

function assetType(relativePath) {
  const clean = relativePath.split(/[?#]/, 1)[0].toLowerCase();
  if (/\.(?:m?js)$/.test(clean)) return 'javascript';
  if (/\.css$/.test(clean)) return 'css';
  if (/\.(?:png|jpe?g|gif|webp|svg|ico|avif)$/.test(clean)) return 'image';
  if (/\.(?:woff2?|ttf|otf|eot)$/.test(clean)) return 'font';
  if (/\.(?:mp3|wav|ogg|m4a|aac|flac)$/.test(clean)) return 'audio';
  if (/\.(?:json|csv|tsv|xml)$/.test(clean)) return 'data';
  if (/\.html?$/.test(clean)) return 'document';
  return 'other';
}

function localReferences(relativePath, contents) {
  const text = contents.toString('utf8');
  const references = new Set();
  const push = (raw) => {
    if (!raw || /^(?:[a-z]+:|\/\/|\/|#|data:)/i.test(raw)) return;
    const clean = raw.split(/[?#]/, 1)[0];
    if (!clean) return;
    const base = posix.dirname(relativePath);
    const normalized = posix.normalize(posix.join(base, clean)).replace(/^\.\//, '');
    if (normalized !== '..' && !normalized.startsWith('../') && !posix.isAbsolute(normalized)) {
      references.add(normalized);
    }
  };

  if (/\.html?$/.test(relativePath)) {
    for (const match of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) push(match[1]);
  }
  if (/\.css$/.test(relativePath)) {
    for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) push(match[1]);
  }
  if (/\.(?:m?js)$/.test(relativePath)) {
    for (const match of text.matchAll(/(?:from\s*|import\s*\(|fetch\s*\()["']([^"']+)["']/g))
      push(match[1]);
  }
  return [...references].sort();
}

async function buildStabilizationReport({
  root,
  deploymentCatalog,
  routeMatrix,
  sourcePeer,
  hubRuntimeAssets,
  peerSample,
}) {
  const diskFiles = new Set(await listFiles(root));
  const routeById = new Map(routeMatrix.entries.map((entry) => [entry.id, entry]));
  const artifacts = [];

  for (const item of deploymentCatalog.items) {
    const route = routeById.get(item.id);
    const record = {
      id: item.id,
      state: route?.state || 'unknown',
      route: route?.url ?? null,
      sourceUrl: route?.sourceUrl ?? item.url ?? null,
      assets: [],
      summary: {
        javascript: 0,
        css: 0,
        image: 0,
        font: 0,
        audio: 0,
        data: 0,
        document: 0,
        other: 0,
        missing: 0,
      },
    };

    if (route?.state === 'deployable' && route.path) {
      const queue = [route.path, ...(item.id === 'app-hub-v13' ? hubRuntimeAssets : [])];
      const seen = new Set();
      while (queue.length) {
        const current = queue.shift();
        if (seen.has(current)) continue;
        seen.add(current);
        const present = diskFiles.has(current);
        const type = assetType(current);
        record.summary[type] += 1;
        if (!present) record.summary.missing += 1;
        const evidence = present ? await fileEvidence(join(root, current)) : null;
        record.assets.push({
          path: current,
          type,
          reachable: present,
          bytes: evidence?.bytes ?? null,
          sha256: evidence?.sha256 ?? null,
        });
        if (!present) continue;
        const contents = await readFile(join(root, current));
        for (const reference of localReferences(current, contents)) {
          if (!seen.has(reference)) queue.push(reference);
        }
      }
      record.assets.sort((a, b) => a.path.localeCompare(b.path));
    }

    record.auditResult =
      route?.state === 'deployable'
        ? record.summary.missing === 0
          ? 'pass'
          : 'fail'
        : route?.state === 'unavailable'
          ? 'blocked'
          : 'not-applicable';
    record.auditReason =
      route?.state === 'deployable'
        ? record.summary.missing === 0
          ? 'All staged runtime assets are reachable.'
          : 'One or more staged runtime assets are missing.'
        : route?.state === 'unavailable'
          ? 'Artifact entry is intentionally unavailable because its target is not staged in this production payload.'
          : route?.state === 'source-only'
            ? 'Artifact entry is explicitly source-only and has no production launch endpoint.'
            : route?.reason || 'No local production asset audit applies.';

    artifacts.push(record);
  }

  const bundleInventory = [];
  for (const relativePath of [...diskFiles].sort()) {
    const type = assetType(relativePath);
    if (!['javascript', 'css'].includes(type)) continue;
    const evidence = await fileEvidence(join(root, relativePath));
    bundleInventory.push({
      path: relativePath,
      type,
      bytes: evidence.bytes,
      budgetBytes: BUNDLE_BUDGET_BYTES,
      overBudget: evidence.bytes > BUNDLE_BUDGET_BYTES,
    });
  }

  const peerCandidates = [
    ...sourcePeer.matchAll(/peernet:\s*'([^']+)'[\s\S]*?peerjslib:\s*'([^']+)'/g),
  ].map(([, peernet, peerjslib]) => ({ peernet, peerjslib }));
  const dependencyValidation = {
    arcadeRuntime: {
      referenced: false,
      status: 'not-used-by-hub-runtime',
      duplicateBundles: 0,
    },
    sharedStyles: {
      referenced: true,
      status:
        bundleInventory.filter((entry) => entry.type === 'css').length === 1
          ? 'single-bundle'
          : 'review',
      duplicateBundles: Math.max(
        0,
        bundleInventory.filter((entry) => entry.type === 'css').length - 1,
      ),
    },
    peernetjs: {
      referenced: peerCandidates.length > 0,
      bundled: false,
      status: 'optional-lazy-external',
      candidates: peerCandidates,
      version: null,
      versionStatus: 'not-declared-in-v13hub',
      duplicateBundles: 0,
      note: 'Peer features fail closed when separately deployed PeernetJS/peerjslib modules are unavailable; local catalog browsing remains independent.',
    },
    peerjslibSample: {
      referenced: true,
      bundled: true,
      status: 'staged-pinned',
      revision: peerSample.revision,
      sourceMode: peerSample.sourceMode,
      route: peerSample.route,
      files: peerSample.files,
      note: 'The Lobby Share sample is staged from the pinned standalone peerjslib build; this does not vendor the optional V13 PeernetJS runtime.',
    },
  };

  const counts = Object.fromEntries(
    Object.entries(Object.groupBy(artifacts, (artifact) => artifact.state)).map(([state, rows]) => [
      state,
      rows.length,
    ]),
  );
  const missingAssets = artifacts.flatMap((artifact) =>
    artifact.assets
      .filter((asset) => !asset.reachable)
      .map((asset) => ({ artifactId: artifact.id, path: asset.path })),
  );
  const auditResults = Object.fromEntries(
    Object.entries(Object.groupBy(artifacts, (artifact) => artifact.auditResult)).map(
      ([result, rows]) => [result, rows.length],
    ),
  );
  return {
    schemaVersion: 'v13hub.stabilization-report/v1',
    productionBase: './',
    thresholds: {
      interactiveMs: INTERACTIVE_BUDGET_MS,
      uncompressedBundleBytes: BUNDLE_BUDGET_BYTES,
    },
    summary: {
      catalogArtifacts: artifacts.length,
      routeStates: counts,
      auditResults,
      scannedDeployableArtifacts: artifacts.filter((artifact) => artifact.state === 'deployable')
        .length,
      missingAssets: missingAssets.length,
      overBudgetBundles: bundleInventory.filter((entry) => entry.overBudget).length,
    },
    artifacts,
    bundleInventory,
    dependencyValidation,
    remainingIssues: [
      ...(artifacts.some((artifact) => artifact.state === 'unavailable')
        ? [
            {
              severity: 'high',
              code: 'catalog-artifacts-not-staged',
              detail:
                'Catalog entries marked unavailable are intentionally non-launchable in this repository production payload, so their nested assets cannot be verified here.',
            },
          ]
        : []),
      {
        severity: 'medium',
        code: 'peer-runtime-external',
        detail:
          'PeernetJS/peerjslib remain optional same-origin sibling deployments and are not included in the standalone V13Hub bundle.',
      },
    ],
  };
}

function digest(buffer, algorithm, encoding = 'hex') {
  return createHash(algorithm).update(buffer).digest(encoding);
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function fingerprintName(path, sha256) {
  const extensionIndex = path.lastIndexOf('.');
  const stem = extensionIndex >= 0 ? path.slice(0, extensionIndex) : path;
  const extension = extensionIndex >= 0 ? path.slice(extensionIndex) : '';
  return `${stem}.${sha256.slice(0, 12)}${extension}`;
}

async function writeRelative(root, relativePath, contents) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function fileEvidence(path) {
  const contents = await readFile(path);
  return {
    bytes: contents.byteLength,
    sha256: digest(contents, 'sha256'),
    sri: `sha384-${digest(contents, 'sha384', 'base64')}`,
  };
}

async function listFiles(root, path = root) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries.toSorted((a, b) => a.name.localeCompare(b.name))) {
    const absolute = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, absolute)));
    else if (entry.isFile()) files.push(relative(root, absolute).split(sep).join('/'));
  }
  return files;
}

async function loadPeerJsLibSample({
  root = process.env.PEERJSLIB_ROOT || DEFAULT_PEERJSLIB_ROOT,
  expectedRevision = REQUIRED_PEERJSLIB_REVISION,
} = {}) {
  const projectRoot = resolve(root);
  if (!/^[a-f0-9]{40}$/u.test(expectedRevision)) {
    throw new Error('peerjslibRevision must be a full 40-character hexadecimal commit id.');
  }

  const cacheKey = `${projectRoot}\0${expectedRevision}`;
  const cached = PEER_SAMPLE_CACHE.get(cacheKey);
  if (cached) return cached;

  const operation = (async () => {
    const nodeModules = join(projectRoot, 'node_modules');
    if (!(await pathExists(nodeModules))) {
      throw new Error(
        `peerjslib dependencies are missing at ${nodeModules}; run "pnpm install --frozen-lockfile" there first.`,
      );
    }

    try {
      await execFileAsync(
        'git',
        ['-C', projectRoot, 'cat-file', '-e', `${expectedRevision}^{commit}`],
        { encoding: 'utf8' },
      );
    } catch (error) {
      throw new Error(
        `V13 requires peerjslib revision ${expectedRevision}, but that commit is unavailable in ${projectRoot}.`,
        { cause: error },
      );
    }

    const temporaryRoot = await mkdtemp(join(tmpdir(), 'v13-peerjslib-'));
    const snapshotRoot = join(temporaryRoot, 'peerjslib');
    try {
      await execFileAsync(
        'git',
        ['clone', '--quiet', '--no-hardlinks', '--no-checkout', projectRoot, snapshotRoot],
        { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
      );
      await execFileAsync(
        'git',
        ['-C', snapshotRoot, 'checkout', '--quiet', '--detach', expectedRevision],
        { encoding: 'utf8' },
      );
      await symlink(
        nodeModules,
        join(snapshotRoot, 'node_modules'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      await execFileAsync('pnpm', ['--dir', snapshotRoot, 'sample:build'], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      });

      const { stdout } = await execFileAsync('git', ['-C', snapshotRoot, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      });
      const revision = stdout.trim();
      if (revision !== expectedRevision) {
        throw new Error(
          `Clean peerjslib snapshot resolved ${revision || '(empty)'} instead of ${expectedRevision}.`,
        );
      }

      const sampleRoot = join(snapshotRoot, 'examples', 'lobby-chat-file-share', 'dist');
      const sourceFiles = await listFiles(sampleRoot);
      if (!sourceFiles.includes('index.html')) {
        throw new Error(`peerjslib Lobby Share build did not emit ${sampleRoot}/index.html.`);
      }

      const assets = new Map();
      const files = [];
      for (const sourcePath of sourceFiles) {
        const absolute = join(sampleRoot, sourcePath);
        const contents = await readFile(absolute);
        const outputPath = posix.join(PEERJSLIB_SAMPLE_PREFIX, sourcePath.split(sep).join('/'));
        assets.set(outputPath, contents);
        files.push(
          Object.freeze({
            sourcePath,
            outputPath,
            bytes: contents.byteLength,
            sha256: digest(contents, 'sha256'),
          }),
        );
      }
      files.sort((left, right) => left.outputPath.localeCompare(right.outputPath));

      return Object.freeze({
        revision,
        sourceMode: 'clean-git-snapshot',
        route: `${PEERJSLIB_SAMPLE_PREFIX}/index.html`,
        assets,
        files: Object.freeze(files),
      });
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  })();

  PEER_SAMPLE_CACHE.set(cacheKey, operation);
  try {
    return await operation;
  } catch (error) {
    PEER_SAMPLE_CACHE.delete(cacheKey);
    throw error;
  }
}

function replaceExactlyOnce(text, needle, replacement, label) {
  const first = text.indexOf(needle);
  if (first < 0 || text.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`Expected exactly one ${label} reference: ${needle}`);
  }
  return text.replace(needle, replacement);
}

export async function verifyBuiltSite(outputDir = DEFAULT_OUTPUT_DIR) {
  const root = resolve(outputDir);
  const manifestPath = join(root, 'asset-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const html = await readFile(join(root, 'index.html'), 'utf8');
  const routeMatrix = JSON.parse(await readFile(join(root, 'route-manifest.json'), 'utf8'));
  const stabilization = JSON.parse(await readFile(join(root, 'stabilization-report.json'), 'utf8'));

  if (!/^<!doctype html>/i.test(html)) throw new Error('Built index.html is missing a doctype.');
  if (!/<html\s+lang="en">/i.test(html)) throw new Error('Built index.html is missing lang="en".');
  if (!/Content-Security-Policy/i.test(html)) throw new Error('Built index.html is missing a CSP.');

  const stylesheet = html.match(
    /<link\s+rel="stylesheet"\s+href="\.\/([^"]+)"\s+integrity="([^"]+)"/i,
  );
  const script = html.match(/<script\s+type="module"\s+src="\.\/([^"]+)"\s+integrity="([^"]+)"/i);
  if (!stylesheet || !script)
    throw new Error('Built HTML is missing fingerprinted integrity-tagged entry assets.');

  for (const [kind, match] of [
    ['stylesheet', stylesheet],
    ['script', script],
  ]) {
    const [, relativePath, declaredIntegrity] = match;
    const absolutePath = join(root, relativePath);
    const evidence = await fileEvidence(absolutePath);
    if (evidence.sri !== declaredIntegrity) {
      throw new Error(`${kind} integrity mismatch for ${relativePath}`);
    }
  }

  const diskFiles = await listFiles(root);
  const hashedDiskFiles = diskFiles.filter(
    (relativePath) => relativePath !== 'asset-manifest.json',
  );
  const manifestFiles = Object.keys(manifest.files).sort();
  if (JSON.stringify(hashedDiskFiles) !== JSON.stringify(manifestFiles)) {
    throw new Error(
      `Build manifest file list does not match dist. disk=${hashedDiskFiles.length} manifest=${manifestFiles.length}`,
    );
  }

  for (const relativePath of diskFiles) {
    if (relativePath === 'asset-manifest.json') continue;
    const evidence = await fileEvidence(join(root, relativePath));
    const recorded = manifest.files[relativePath];
    if (
      !recorded ||
      recorded.sha256 !== evidence.sha256 ||
      recorded.sri !== evidence.sri ||
      recorded.bytes !== evidence.bytes
    ) {
      throw new Error(`Build evidence mismatch for ${relativePath}`);
    }
  }

  for (const [sourcePath, builtPath] of Object.entries(manifest.fingerprints || {})) {
    const recorded = manifest.files[builtPath];
    if (!recorded) throw new Error(`Fingerprint target is missing from build: ${builtPath}`);
    if (fingerprintName(sourcePath, recorded.sha256) !== builtPath) {
      throw new Error(`Fingerprint filename does not match content hash: ${builtPath}`);
    }
  }

  const peerInput = manifest.inputs?.peerjslibSample;
  if (!peerInput || peerInput.revision !== REQUIRED_PEERJSLIB_REVISION) {
    throw new Error('Build manifest is missing the required pinned peerjslib sample revision.');
  }
  for (const sourceFile of peerInput.files || []) {
    const recorded = manifest.files[sourceFile.outputPath];
    if (!recorded || recorded.bytes !== sourceFile.bytes || recorded.sha256 !== sourceFile.sha256) {
      throw new Error(`Pinned peerjslib sample evidence mismatch for ${sourceFile.outputPath}`);
    }
  }

  const catalogPath = manifest.fingerprints?.['catalog.json'];
  const builtCatalog = JSON.parse(await readFile(join(root, catalogPath), 'utf8'));
  const catalogById = new Map(builtCatalog.items.map((item) => [item.id, item]));
  const deadInternalRoutes = findDeadInternalRoutes(routeMatrix, {
    stagedPaths: new Set(diskFiles),
  });
  if (deadInternalRoutes.length) {
    const dead = deadInternalRoutes.map((entry) => `${entry.id} -> ${entry.path || '(none)'}`);
    throw new Error(`Dead deployable route(s): ${dead.join(', ')}`);
  }
  for (const entry of routeMatrix.entries || []) {
    const item = catalogById.get(entry.id);
    if (!item) throw new Error(`Route matrix references unknown artifact: ${entry.id}`);
    if (entry.state === 'deployable') {
      if (!item.url) throw new Error(`Deployable catalog item has no URL: ${entry.id}`);
    } else if (['source-only', 'unavailable'].includes(entry.state) && item.url != null) {
      throw new Error(`Non-deployable catalog item still exposes a URL: ${entry.id}`);
    }
  }

  if (stabilization.summary.catalogArtifacts !== builtCatalog.items.length) {
    throw new Error('Stabilization report does not cover the complete deployed catalog.');
  }
  if (stabilization.summary.missingAssets !== 0) {
    throw new Error(
      `Stabilization report contains ${stabilization.summary.missingAssets} missing deployable assets.`,
    );
  }
  if (stabilization.summary.overBudgetBundles !== 0) {
    throw new Error(
      `Stabilization report contains ${stabilization.summary.overBudgetBundles} bundle budget violations.`,
    );
  }

  return Object.freeze({
    files: diskFiles.length,
    entryScript: script[1],
    entryStylesheet: stylesheet[1],
    manifest,
    routeMatrix,
    stabilization,
  });
}

export async function buildStaticSite({
  sourceDir = DEFAULT_SOURCE_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  peerjslibRoot = process.env.PEERJSLIB_ROOT || DEFAULT_PEERJSLIB_ROOT,
  peerjslibRevision = REQUIRED_PEERJSLIB_REVISION,
} = {}) {
  const source = resolve(sourceDir);
  const output = resolve(outputDir);
  if (
    source === output ||
    output.startsWith(`${source}${sep}`) ||
    source.startsWith(`${output}${sep}`)
  ) {
    throw new Error('Output directory must not overlap the source directory.');
  }

  const sources = {};
  for (const relativePath of RUNTIME_SOURCE_FILES) {
    sources[relativePath] = await readFile(join(source, relativePath));
  }

  const peerSample = await loadPeerJsLibSample({
    root: peerjslibRoot,
    expectedRevision: peerjslibRevision,
  });
  const sourceCatalog = JSON.parse(sources['catalog.json'].toString('utf8'));
  const deploymentCatalog = reconcileCatalogForDeployment(sourceCatalog, {
    stagedPaths: new Set(['index.html', ...peerSample.assets.keys()]),
  });
  const catalogBuffer = Buffer.from(`${JSON.stringify(deploymentCatalog, null, 2)}\n`);
  const routeMatrixBuffer = Buffer.from(
    `${JSON.stringify(buildRouteMatrix(deploymentCatalog), null, 2)}\n`,
  );
  const catalogName = fingerprintName('catalog.json', digest(catalogBuffer, 'sha256'));
  const catalogLibName = fingerprintName(
    'lib/catalog.js',
    digest(sources['lib/catalog.js'], 'sha256'),
  );
  const discoveryLibName = fingerprintName(
    'lib/discovery.js',
    digest(sources['lib/discovery.js'], 'sha256'),
  );
  const navigationLibName = fingerprintName(
    'lib/navigation.js',
    digest(sources['lib/navigation.js'], 'sha256'),
  );
  const policyLibName = fingerprintName(
    'lib/policy.js',
    digest(sources['lib/policy.js'], 'sha256'),
  );
  const routesLibName = fingerprintName(
    'lib/routes.js',
    digest(sources['lib/routes.js'], 'sha256'),
  );
  const stateLibName = fingerprintName('lib/state.js', digest(sources['lib/state.js'], 'sha256'));

  let collectionSource = sources['lib/collection.js'].toString('utf8');
  collectionSource = replaceExactlyOnce(
    collectionSource,
    "'./catalog.js'",
    `'./${basename(catalogLibName)}'`,
    'collection catalog module',
  );
  const collectionBuffer = Buffer.from(collectionSource);
  const collectionLibName = fingerprintName(
    'lib/collection.js',
    digest(collectionBuffer, 'sha256'),
  );

  let peerSource = sources['lib/peer.js'].toString('utf8');
  peerSource = replaceExactlyOnce(
    peerSource,
    "'./catalog.js'",
    `'./${basename(catalogLibName)}'`,
    'peer catalog module',
  );
  const peerBuffer = Buffer.from(peerSource);
  const peerLibName = fingerprintName('lib/peer.js', digest(peerBuffer, 'sha256'));

  let appSource = sources['app.js'].toString('utf8');
  for (const [sourcePath, builtPath] of [
    ['lib/catalog.js', catalogLibName],
    ['lib/collection.js', collectionLibName],
    ['lib/discovery.js', discoveryLibName],
    ['lib/navigation.js', navigationLibName],
    ['lib/policy.js', policyLibName],
    ['lib/peer.js', peerLibName],
    ['lib/routes.js', routesLibName],
    ['lib/state.js', stateLibName],
  ]) {
    appSource = replaceExactlyOnce(
      appSource,
      `'./${sourcePath}'`,
      `'./${builtPath}'`,
      `${sourcePath} module`,
    );
  }
  appSource = replaceExactlyOnce(
    appSource,
    "'./catalog.json'",
    `'./${catalogName}'`,
    'catalog fetch',
  );
  const appBuffer = Buffer.from(appSource);
  const styleSource = sources['styles.css'];
  const appSha = digest(appBuffer, 'sha256');
  const styleSha = digest(styleSource, 'sha256');
  const appName = fingerprintName('app.js', appSha);
  const styleName = fingerprintName('styles.css', styleSha);
  const appSri = `sha384-${digest(appBuffer, 'sha384', 'base64')}`;
  const styleSri = `sha384-${digest(styleSource, 'sha384', 'base64')}`;

  let html = sources['index.html'].toString('utf8');
  html = replaceExactlyOnce(
    html,
    '<link rel="stylesheet" href="./styles.css">',
    `<link rel="stylesheet" href="./${styleName}" integrity="${styleSri}">`,
    'stylesheet',
  );
  html = replaceExactlyOnce(
    html,
    '<script type="module" src="./app.js"></script>',
    `<script type="module" src="./${appName}" integrity="${appSri}"></script>`,
    'module script',
  );

  await mkdir(dirname(output), { recursive: true });
  const staging = await mkdtemp(join(dirname(output), `.${basename(output)}-build-`));
  try {
    const assets = new Map([
      [catalogName, catalogBuffer],
      [catalogLibName, sources['lib/catalog.js']],
      [collectionLibName, collectionBuffer],
      [discoveryLibName, sources['lib/discovery.js']],
      [navigationLibName, sources['lib/navigation.js']],
      [policyLibName, sources['lib/policy.js']],
      [peerLibName, peerBuffer],
      [routesLibName, sources['lib/routes.js']],
      [stateLibName, sources['lib/state.js']],
      [appName, appBuffer],
      [styleName, styleSource],
      ['index.html', html],
      ['route-manifest.json', routeMatrixBuffer],
      ...peerSample.assets.entries(),
    ]);
    for (const [relativePath, contents] of assets) {
      await writeRelative(staging, relativePath, contents);
    }

    const stabilization = await buildStabilizationReport({
      root: staging,
      deploymentCatalog,
      routeMatrix: buildRouteMatrix(deploymentCatalog),
      sourcePeer: sources['lib/peer.js'].toString('utf8'),
      hubRuntimeAssets: [...assets.keys()].filter(
        (path) => path !== 'route-manifest.json' && !path.startsWith(`${PEERJSLIB_SAMPLE_PREFIX}/`),
      ),
      peerSample,
    });
    await writeRelative(
      staging,
      'stabilization-report.json',
      `${JSON.stringify(stabilization, null, 2)}\n`,
    );

    const currentFiles = await listFiles(staging);
    const files = {};
    for (const relativePath of currentFiles) {
      files[relativePath] = await fileEvidence(join(staging, relativePath));
    }

    const manifest = {
      schemaVersion: 'v13hub.static-build/v1',
      entrypoint: 'index.html',
      fingerprints: {
        'app.js': appName,
        'styles.css': styleName,
        'catalog.json': catalogName,
        'lib/catalog.js': catalogLibName,
        'lib/collection.js': collectionLibName,
        'lib/discovery.js': discoveryLibName,
        'lib/navigation.js': navigationLibName,
        'lib/policy.js': policyLibName,
        'lib/peer.js': peerLibName,
        'lib/routes.js': routesLibName,
        'lib/state.js': stateLibName,
      },
      routes: 'route-manifest.json',
      stabilization: 'stabilization-report.json',
      inputs: {
        peerjslibSample: {
          revision: peerSample.revision,
          sourceMode: peerSample.sourceMode,
          route: peerSample.route,
          files: peerSample.files,
        },
      },
      files,
    };
    // The manifest intentionally does not hash itself; recursive self-digests have no stable
    // fixed point. Every deployable payload referenced by the manifest is hashed.
    await writeRelative(staging, 'asset-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
    const verification = await verifyBuiltSite(staging);

    const hadPreviousOutput = await pathExists(output);
    const backup = join(dirname(output), `.${basename(output)}-previous-${randomUUID()}`);
    if (hadPreviousOutput) await rename(output, backup);
    try {
      await rename(staging, output);
    } catch (error) {
      if (hadPreviousOutput) await rename(backup, output);
      throw error;
    }
    if (hadPreviousOutput) await rm(backup, { recursive: true, force: true });
    return Object.freeze({
      outputDir: output,
      ...verification,
    });
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
