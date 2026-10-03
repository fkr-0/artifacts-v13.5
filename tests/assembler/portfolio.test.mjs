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
