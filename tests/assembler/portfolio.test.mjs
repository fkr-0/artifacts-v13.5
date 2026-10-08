import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assemblePortfolio, classifyBaselineItem, routePath } from '../../scripts/portfolio-lib.mjs';

function baseline(items) {
  return { schemaVersion: 'artifacts-v13.5/baseline-v1', source: { kind: 'test-fixture' }, items };
}
const meme = {
  id: 'meme-lab', title: 'Meme Lab', availability: 'provisional',
  sourceKind: 'directory', buildMode: 'none', url: '/meme-lab/meme-lab.html',
};

test('routePath strips query strings and rejects external routes', () => {
  assert.equal(routePath('/legacy-tools.html?tool=v9-notepad'), 'legacy-tools.html');
  assert.equal(routePath('https://example.test/tool'), null);
});

test('Git Recipe Book serves the compiled curriculum at its stable legacy route', async () => {
  const root = await mkdtemp(join(tmpdir(), 'v13-5-git-recipe-'));
  const source = join(root, 'source');
  const dist = join(source, 'git-recipe-book/dist');
  const output = join(root, 'out');
  await mkdir(join(dist, 'assets'), { recursive: true });
  await mkdir(join(source, 'meme-lab'), { recursive: true });
  await writeFile(join(source, 'meme-lab/meme-lab.html'), '<title>Meme</title>');
  await writeFile(join(source, 'git-recipe-book/index.html'), '<script type="module" src="./src/main.tsx"></script>');
  await writeFile(join(dist, 'index.html'),
    '<link rel="icon" href="data:,"><script type="module" src="./assets/main.js"></script><link rel="stylesheet" href="./assets/main.css">');
  await writeFile(join(dist, 'assets/main.js'), 'document.querySelector("body").dataset.loaded = "true";');
  await writeFile(join(dist, 'assets/main.css'), 'body{display:block}');
  const item = { id: 'git-recipe-book', title: 'Git Recipe Book', version: '1.1.0',
    availability: 'source-only', sourceKind: 'project', buildMode: 'compile',
    url: '/git-recipe-book/index.html' };
  const manifest = { build: { mode: 'compile', cwd: 'git-recipe-book', output: 'dist' },
    release: { entrypoint: 'index.html' }, verify: { expectedFiles: ['index.html'] } };
  const result = await assemblePortfolio({ baseline: baseline([meme, item]), sourceRoot: source,
    nativeManifests: { 'git-recipe-book': manifest }, outputRoot: output, strict: true });
  const deployed = result.deploymentCatalog.items.find((candidate) => candidate.id === 'git-recipe-book');
  assert.equal(deployed.availability, 'verified');
  assert.equal(deployed.url, '/git-recipe-book/index.html');
  assert.equal(deployed.deployment.sourceKind, 'canonical-compiled');
  assert.equal(deployed.receipt.files, 3);
  assert.equal(result.parity.summary.expectedLocal, 1);
  assert.equal(result.routeManifest.entries.find((entry) => entry.id === 'git-recipe-book').state, 'staged');
  assert.match(await readFile(join(output, 'git-recipe-book/index.html'), 'utf8'), /assets\/main.js/);
  const assets = JSON.parse(await readFile(join(output, 'asset-manifest.json'), 'utf8'));
  assert.match(assets.files['git-recipe-book/assets/main.js'].sha256, /^[a-f0-9]{64}$/u);

  await writeFile(join(dist, 'index.html'), '<script type="module" src="./src/main.tsx"></script>');
  await assert.rejects(assemblePortfolio({ baseline: baseline([item]), sourceRoot: source,
    nativeManifests: { 'git-recipe-book': manifest }, outputRoot: output, strict: true }),
    /compiled JavaScript and CSS entrypoints/);
});

test('Git Recipe Book refuses missing builds rather than silently shipping Vite source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'v13-5-git-recipe-missing-'));
  const source = join(root, 'source');
  await mkdir(join(source, 'git-recipe-book'), { recursive: true });
  await writeFile(join(source, 'git-recipe-book/index.html'), '<script src="./src/main.tsx"></script>');
  const item = { id: 'git-recipe-book', title: 'Git Recipe Book', version: '1.1.0',
    availability: 'source-only', sourceKind: 'project', buildMode: 'compile',
    url: '/git-recipe-book/index.html' };
  await assert.rejects(assemblePortfolio({ baseline: baseline([item]), sourceRoot: source,
    outputRoot: join(root, 'out'), strict: true }), /compiled release manifest/);
  await assert.rejects(assemblePortfolio({ baseline: baseline([item]), sourceRoot: source,
    outputRoot: join(root, 'out'), nativeManifests: { 'git-recipe-book': {
      build: { mode: 'compile', cwd: 'git-recipe-book', output: 'dist' }, release: { entrypoint: 'index.html' },
    } }, strict: true }), /compiled dist\/index.html is missing/);
});

test('provisional local V12 entries are release parity requirements', () => {
  assert.equal(classifyBaselineItem(meme), 'expected-local');
  assert.equal(classifyBaselineItem({ ...meme, id: 'source', availability: 'source-only' }), 'optional-local');
});

test('migration assembly physically stages Meme Lab and hashes the payload', async () => {
  const root = await mkdtemp(join(tmpdir(), 'v13-5-assembler-'));
  const source = join(root, 'source');
  const output = join(root, 'dist');
  await mkdir(join(source, 'meme-lab'), { recursive: true });
  await writeFile(join(source, 'meme-lab', 'meme-lab.html'), '<!doctype html><title>Meme</title>');
  const result = await assemblePortfolio({ baseline: baseline([meme]), sourceRoot: source, outputRoot: output, strict: true });
  assert.equal(result.parity.regressions.memeLab.staged, true);
  assert.equal(result.parity.summary.missingExpected, 0);
  assert.match(await readFile(join(output, 'meme-lab', 'meme-lab.html'), 'utf8'), /Meme/);
  const manifest = JSON.parse(await readFile(join(output, 'asset-manifest.json'), 'utf8'));
  assert.equal(typeof manifest.files['meme-lab/meme-lab.html'].sha256, 'string');
});

test('strict assembly fails when an expected V12 artifact disappears', async () => {
  const root = await mkdtemp(join(tmpdir(), 'v13-5-missing-'));
  const source = join(root, 'source');
  const output = join(root, 'dist');
  await mkdir(join(source, 'meme-lab'), { recursive: true });
  await writeFile(join(source, 'meme-lab', 'meme-lab.html'), 'meme');
  const missing = {
    id: 'lost-tool', title: 'Lost Tool', availability: 'provisional',
    sourceKind: 'directory', buildMode: 'none', url: '/lost-tool/index.html',
  };
  await assert.rejects(
    assemblePortfolio({ baseline: baseline([meme, missing]), sourceRoot: source, outputRoot: output, strict: true }),
    /strict parity failed/,
  );
  const report = JSON.parse(await readFile(join(output, 'parity-report.json'), 'utf8'));
  assert.equal(report.summary.missingExpected, 1);
  assert.equal(report.entries.find((entry) => entry.id === 'lost-tool').state, 'missing');
});

test('source-only local entries may remain unresolved without weakening expected parity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'v13-5-source-only-'));
  const source = join(root, 'source');
  const output = join(root, 'dist');
  await mkdir(join(source, 'meme-lab'), { recursive: true });
  await writeFile(join(source, 'meme-lab', 'meme-lab.html'), 'meme');
  const result = await assemblePortfolio({
    baseline: baseline([
      meme,
      { id: 'docs-source', title: 'Docs source', availability: 'source-only',
        sourceKind: 'file', buildMode: 'assemble', url: '/docs/missing.md' },
    ]),
    sourceRoot: source, outputRoot: output, strict: true,
  });
  assert.equal(result.parity.summary.missingExpected, 0);
  assert.equal(result.parity.entries.find((entry) => entry.id === 'docs-source').state, 'source-only');
});
