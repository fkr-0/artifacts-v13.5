import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { classifyBaselineItem } from '../../scripts/portfolio-lib.mjs';

const baseline = JSON.parse(
  await readFile(new URL('../../catalog/v12-baseline.json', import.meta.url), 'utf8'),
);

test('V12 parity baseline locks the expected local portfolio and Meme Lab route', () => {
  const expected = baseline.items.filter((item) => classifyBaselineItem(item) === 'expected-local');
  assert.equal(expected.length, 44);
  const meme = expected.find((item) => item.id === 'meme-lab');
  assert.ok(meme);
  assert.equal(meme.url, '/meme-lab/meme-lab.html');
  assert.equal(meme.availability, 'provisional');
});

test('legacy compatibility hosts are explicit source files, not silent missing-route downgrades', async () => {
  const required = [
    '../../catalog/compat-runtime/legacy-tools.html',
    '../../catalog/compat-runtime/markdown-viewer.html',
    '../../catalog/compat-runtime/app-hub/v9-portal.html',
    '../../catalog/compat-runtime/app-hub/v10-portal.html',
    '../../catalog/compat-runtime/app-hub/v10-portal-enhanced.html',
    '../../catalog/compat-runtime/app-hub/bomberman.html',
    '../../catalog/compat-runtime/app-hub/collab-editor.html',
    '../../catalog/compat-runtime/app-hub/collab-editor-lite.html',
  ];
  for (const path of required) {
    const contents = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.ok(contents.length > 100, path + ' should contain preserved compatibility runtime content');
  }
});
