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

try {
  const result = await assemblePortfolio({ baseline, sourceRoot, fallbackRoots: [{ root: compatRoot, kind: 'v11-compat' }], outputRoot, hubRoot: root, strict });
  const summary = result.parity.summary;
  console.log('V13.5 portfolio: ' + summary.stagedExpected + '/' + summary.expectedLocal +
    ' expected V12 local artifacts staged; ' + summary.missingExpected + ' unresolved.');
  console.log('Meme Lab: ' + (result.parity.regressions.memeLab.staged ? 'staged' : 'missing'));
  if (!strict && summary.missingExpected) {
    console.log('Migration build completed with unresolved routes; release qualification remains blocked.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
