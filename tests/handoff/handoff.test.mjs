import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertCanonicalSourceRevision,
  assertCleanTrackedStatus,
  createPublicationHandoff,
  HANDOFF_SCHEMA,
} from '../../scripts/handoff-lib.mjs';

test('handoff refuses tracked dirty state', () => {
  assert.doesNotThrow(() => assertCleanTrackedStatus(''));
  assert.throws(
    () => assertCleanTrackedStatus(' M scripts/build.mjs\n'),
    /clean tracked working tree/,
  );
});

test('canonical source revision records exact or descendant source checkouts', () => {
  const pinnedRevision = '1'.repeat(40);
  assert.equal(
    assertCanonicalSourceRevision({
      pinnedRevision,
      actualRevision: pinnedRevision,
      pinnedIsAncestor: true,
    }).mode,
    'exact',
  );
  assert.equal(
    assertCanonicalSourceRevision({
      pinnedRevision,
      actualRevision: '2'.repeat(40),
      pinnedIsAncestor: true,
    }).mode,
    'descendant',
  );
  assert.throws(
    () => assertCanonicalSourceRevision({
      pinnedRevision,
      actualRevision: '3'.repeat(40),
      pinnedIsAncestor: false,
    }),
    /not the pinned revision or its descendant/,
  );
});

test('handoff records deployment owner, parity and evidence hashes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'v13-5-handoff-'));
  await mkdir(join(root, 'lib'), { recursive: true });
  await mkdir(join(root, 'meme-lab'), { recursive: true });
  await mkdir(join(root, 'artifacts/revealive/0.1.0'), { recursive: true });

  const files = {
    'index.html': 'hub',
    'app.js': 'app',
    'styles.css': 'css',
    'lib/discovery.mjs': 'discovery',
    'lib/favorites.mjs': 'favorites',
    'meme-lab/meme-lab.html': 'meme',
    'artifacts/revealive/0.1.0/index.html': 'revealive',
  };
  for (const [path, contents] of Object.entries(files)) {
    await writeFile(join(root, path), contents);
  }

  const fakeEvidence = (contents) => ({
    bytes: Buffer.byteLength(contents),
    sha256: 'a'.repeat(64),
  });
  const assets = {
    schemaVersion: 'artifacts-v13.5/asset-manifest-v1',
    files: Object.fromEntries(
      Object.entries(files).map(([path, contents]) => [path, fakeEvidence(contents)]),
    ),
  };
  for (const path of ['catalog.json', 'parity-report.json', 'route-manifest.json']) {
    assets.files[path] = fakeEvidence(path);
  }

  const catalog = {
    summary: { total: 55, verified: 2, provisional: 44, sourceOnly: 8 },
    superset: {
      replaces: ['app-hub-v12', 'app-hub-v13'],
      currentNativeAdded: ['revealive'],
    },
    items: [
      { id: 'app-hub-v13.5', url: '/index.html' },
      { id: 'meme-lab', url: '/meme-lab/meme-lab.html' },
      {
        id: 'revealive',
        version: '0.1.0',
        availability: 'verified',
        url: '/artifacts/revealive/0.1.0/index.html',
        deployment: { revision: '7'.repeat(40) },
      },
      ...Array.from({ length: 52 }, (_, index) => ({ id: 'fixture-' + index })),
    ],
  };
  const parity = {
    summary: { expectedLocal: 44, stagedExpected: 44, missingExpected: 0 },
  };
  const routes = {
    entries: [
      { id: 'app-hub-v13.5', state: 'staged' },
      { id: 'meme-lab', state: 'staged' },
      { id: 'revealive', state: 'staged' },
    ],
  };

  await writeFile(join(root, 'catalog.json'), JSON.stringify(catalog));
  await writeFile(join(root, 'parity-report.json'), JSON.stringify(parity));
  await writeFile(join(root, 'route-manifest.json'), JSON.stringify(routes));
  await writeFile(join(root, 'asset-manifest.json'), JSON.stringify(assets));

  const handoff = await createPublicationHandoff({
    distRoot: root,
    v13Commit: '1'.repeat(40),
    generatedAt: '2026-10-03T00:00:00.000Z',
  });
  assert.equal(handoff.schemaVersion, HANDOFF_SCHEMA);
  assert.equal(handoff.release.catalogItems, 55);
  assert.equal(handoff.release.stagedV12Local, 44);
  assert.equal(handoff.deploymentOwner.repository, 'fkr-0/artifact-lab-pages');
  assert.equal(handoff.deploymentOwner.site, 'artifacts.fkr.dev');
  assert.equal(handoff.integration.remotePublicationPerformed, false);

  const persisted = JSON.parse(await readFile(join(root, 'PUBLICATION_HANDOFF.json'), 'utf8'));
  assert.equal(persisted.release.commit, '1'.repeat(40));
});
