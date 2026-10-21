import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const descriptorPath = join(root, 'catalog/editorial-reports.json');

test('Roborock field report has a stable, uniquely cataloged release route', async () => {
  const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
  assert.equal(descriptor.schemaVersion, 'artifacts-v13.5/editorial-reports-v1');
  const ids = descriptor.reports.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  const report = descriptor.reports.find((item) => item.id === 'roborock-local-cloud');
  assert.ok(report);
  assert.equal(report.route, 'research/roborock-local-cloud/index.html');
  assert.ok(report.source.startsWith('src/reports/'));
  const html = await readFile(join(root, report.source), 'utf8');
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<title>Roborock Local Cloud: TLS and CA Trust/);
  for (const chapter of ['mechanism', 'boundaries', 'firmware', 'emudhra', 'sources']) {
    assert.match(html, new RegExp('id="' + chapter + '"'));
    assert.match(html, new RegExp('href="#' + chapter + '"'));
  }
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /@media print/);
  assert.match(html, /technical_writeup/);
  assert.match(html, /blog.mozilla.org/);
  assert.match(html, /blog.google/);
  assert.match(html, /not establish whether any Roborock firmware trusts/);
  assert.match(html, /<h1>Roborock local-cloud authentication and the eMudhra CA incident<\/h1>/);
  assert.doesNotMatch(html, /<h1>[^<]*<br><em>/);
  assert.doesNotMatch(html, /<section id="top" class="hero">/);
  assert.match(html, /<header class="report-header" id="top">/);
  assert.match(html, /--max:1160px/);
  assert.match(html, /five separate gates/i);
  assert.match(html, /gates? 3–4/i);
  assert.match(html, /Detailed capability-by-capability comparison/);
  assert.match(html, /already paired/i);
  assert.match(html, /17 October 2026/i);
  assert.match(html, /certificate issued under an affected eMudhra intermediate is accepted/);
  assert.match(html, /It does <em>not<\/em> assume network-path control/);
  assert.match(html, /V2 region public-key recovery/);
  assert.match(html, /<table class="wide">/);
  assert.ok((html.match(/<tr>/g) || []).length >= 60, 'rich comparative tables');
  assert.ok((html.match(/class="figure"/g) || []).length >= 5, 'multiple accessible figures');
  assert.equal((html.match(/<div class="gate">/g) || []).length, 5);
});

test('compiled publication includes the field report when built', async () => {
  const stage = join(root, 'dist/research/roborock-local-cloud/index.html');
  const found = await stat(stage).then(() => true, () => false);
  if (!found) return; // Build integration is covered by the release:check gate.
  const source = join(root, 'src/reports/roborock-local-cloud/index.html');
  const [sourceInfo, stageInfo] = await Promise.all([stat(source), stat(stage)]);
  if (sourceInfo.mtimeMs > stageInfo.mtimeMs) return; // Existing dist predates this source revision.
  const html = await readFile(stage, 'utf8');
  assert.match(html, /Roborock local-cloud authentication/);
  const catalog = JSON.parse(await readFile(join(root, 'dist/catalog.json'), 'utf8'));
  const item = catalog.items.find((entry) => entry.id === 'roborock-local-cloud');
  assert.ok(item, 'editorial report must be discoverable in the launcher catalog');
  assert.equal(item.availability, 'verified');
  assert.equal(item.url, '/research/roborock-local-cloud/index.html');
  const routes = JSON.parse(await readFile(join(root, 'dist/route-manifest.json'), 'utf8'));
  assert.equal(routes.entries.find((entry) => entry.id === 'roborock-local-cloud')?.state, 'staged');
  const assets = JSON.parse(await readFile(join(root, 'dist/asset-manifest.json'), 'utf8'));
  assert.ok(assets.files['research/roborock-local-cloud/index.html']?.sha256);
});
