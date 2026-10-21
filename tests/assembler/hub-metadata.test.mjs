import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readHubGitMetadata } from '../../scripts/portfolio-lib.mjs';

test('Git metadata is sourced from the real hub checkout', async () => {
  const root = new URL('../..', import.meta.url).pathname;
  const result = await readHubGitMetadata(root);
  assert.match(result.revision, /^[0-9a-f]{40}$/u);
  assert.ok(Number.isSafeInteger(result.commitCount) && result.commitCount > 0);
  assert.ok(Number.isFinite(Date.parse(result.lastCommitAt)));
  assert.equal(typeof result.dirty, 'boolean');
});

test('non-Git fixtures do not receive fabricated provenance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'v13-5-no-git-'));
  assert.deepEqual(await readHubGitMetadata(root), {
    revision: null, commitCount: null, lastCommitAt: null, dirty: null,
  });
});
