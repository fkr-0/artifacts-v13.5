#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemblePortfolio } from './portfolio-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function arg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; }

const baselinePath = resolve(arg('--baseline') || resolve(root, 'catalog/v12-baseline.json'));
const sourceRoot = resolve(arg('--source-root') || process.env.ARTIFACTS_SOURCE_ROOT || resolve(homedir(), 'work/code/artifacts'));
const outputRoot = resolve(arg('--out') || resolve(root, 'dist'));
const compatRoot = resolve(arg('--compat-root') || resolve(root, 'catalog/compat-runtime'));
const strict = !process.argv.includes('--allow-unresolved');
const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

const nativeCatalog = await readJson(resolve(sourceRoot, 'registry/generated/catalog.json'));
const nativeManifests = {};
if (nativeCatalog && Array.isArray(nativeCatalog.items)) {
  const baselineIds = new Set(baseline.items.map((item) => item.id));
  for (const item of nativeCatalog.items) {
    if (baselineIds.has(item.id) || item.id === 'app-hub-v13') continue;
    const manifest = await readJson(resolve(sourceRoot, 'registry/sources.d', item.id + '.json'));
    if (manifest) nativeManifests[item.id] = manifest;
  }
}

try {
  const result = await assemblePortfolio({ baseline, sourceRoot, fallbackRoots: [{ root: compatRoot, kind: 'v11-compat' }], outputRoot, hubRoot: root, nativeCatalog, nativeManifests, strict });
  const summary = result.parity.summary;
  console.log('V13.5 portfolio: ' + summary.stagedExpected + '/' + summary.expectedLocal +
    ' expected V12 local artifacts staged; ' + summary.missingExpected + ' unresolved.');
  console.log('Meme Lab: ' + (result.parity.regressions.memeLab.staged ? 'staged' : 'missing'));
  console.log('Final catalog: ' + result.deploymentCatalog.items.length + ' items; native additions: ' + result.deploymentCatalog.superset.currentNativeAdded.join(', '));
  if (!strict && summary.missingExpected) {
    console.log('Migration build completed with unresolved routes; release qualification remains blocked.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
