#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  assertCanonicalSourceRevision,
  assertCleanTrackedStatus,
  CANONICAL_SOURCE,
  createPublicationHandoff,
} from './handoff-lib.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(
  process.env.ARTIFACTS_SOURCE_ROOT ||
  resolve(process.env.HOME || '.', 'work/code/artifacts'),
);

async function git(args, cwd = root) {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
}

async function isAncestor(cwd, ancestor, descendant) {
  try {
    await execFileAsync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

const statusBefore = await git(['status', '--porcelain', '--untracked-files=no']);
assertCleanTrackedStatus(statusBefore);

const commit = await git(['rev-parse', 'HEAD']);
const sourceRevision = await git(['rev-parse', 'HEAD'], sourceRoot);
const sourceTransition = assertCanonicalSourceRevision({
  pinnedRevision: CANONICAL_SOURCE.revision,
  actualRevision: sourceRevision,
  pinnedIsAncestor: sourceRevision === CANONICAL_SOURCE.revision
    ? true
    : await isAncestor(sourceRoot, CANONICAL_SOURCE.revision, sourceRevision),
});
const { stdout, stderr } = await execFileAsync(
  process.execPath,
  ['scripts/build.mjs'],
  {
    cwd: root,
    env: { ...process.env, ARTIFACTS_SOURCE_ROOT: sourceRoot },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  },
);
if (stdout.trim()) process.stdout.write(stdout);
if (stderr.trim()) process.stderr.write(stderr);

const statusAfter = await git(['status', '--porcelain', '--untracked-files=no']);
assertCleanTrackedStatus(statusAfter);

const handoff = await createPublicationHandoff({
  distRoot: resolve(root, 'dist'),
  v13Commit: commit,
  canonicalSource: {
    ...CANONICAL_SOURCE,
    currentRevision: sourceRevision,
    transition: sourceTransition.mode,
  },
});

console.log(
  'Publication handoff: commit ' + handoff.release.commit.slice(0, 12) +
  ', source ' + handoff.canonicalSource.currentRevision.slice(0, 12) +
  ' (' + handoff.canonicalSource.transition + ')' +
  ', ' + handoff.release.stagedV12Local + '/' + handoff.release.expectedV12Local +
  ' V12 routes, ' + handoff.release.catalogItems + ' catalog items -> dist/PUBLICATION_HANDOFF.json',
);
