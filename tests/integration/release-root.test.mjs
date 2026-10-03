import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assemblePortfolio } from '../../scripts/portfolio-lib.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('assembled release root contains launcher and restored artifact routes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'v13-5-integration-'));
  const source = join(root, 'source');
  const output = join(root, 'dist');
  await mkdir(join(source, 'meme-lab'), { recursive: true });
  await writeFile(join(source, 'meme-lab', 'meme-lab.html'), '<!doctype html><title>Meme Lab</title>');

  const baseline = {
    schemaVersion: 'artifacts-v13.5/baseline-v1',
    source: { kind: 'integration-fixture' },
    items: [{
      id: 'meme-lab',
      title: 'Meme Lab',
      availability: 'provisional',
      sourceKind: 'directory',
      buildMode: 'none',
      url: '/meme-lab/meme-lab.html',
    }],
  };

  await assemblePortfolio({
    baseline,
    sourceRoot: source,
    outputRoot: output,
    hubRoot: projectRoot,
    strict: true,
  });

  const html = await readFile(join(output, 'index.html'), 'utf8');
  const app = await readFile(join(output, 'app.js'), 'utf8');
  const manifest = JSON.parse(await readFile(join(output, 'asset-manifest.json'), 'utf8'));

  assert.match(html, /Artifacts <span>V13\.5<\/span>/);
  assert.match(app, /'\.\/lib\/discovery\.mjs'/);
  assert.doesNotMatch(app, /'\.\.\/lib\/discovery\.mjs'/);
  assert.equal(typeof manifest.files['index.html'].sha256, 'string');
  assert.equal(typeof manifest.files['app.js'].sha256, 'string');
  assert.equal(typeof manifest.files['meme-lab/meme-lab.html'].sha256, 'string');
  assert.match(await readFile(join(output, 'meme-lab', 'meme-lab.html'), 'utf8'), /Meme Lab/);
});
