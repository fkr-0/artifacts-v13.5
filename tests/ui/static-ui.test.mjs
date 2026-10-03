import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../src/ui/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../../src/ui/app.js', import.meta.url), 'utf8');

test('launcher exposes browse controls and direct Open action', () => {
  assert.match(html, /id="search"/);
  assert.match(html, /id="kind-filter"/);
  assert.match(html, /id="availability-filter"/);
  assert.match(html, /class="open"[^>]*>Open</);
});

test('Favorites are optional and represented as pressed state', () => {
  assert.match(html, /id="favorites-only"/);
  assert.match(html, /aria-pressed="false"/);
  assert.doesNotMatch(html, /Add metadata to collection/i);
});

test('accessibility landmarks and status semantics are present', () => {
  assert.match(html, /class="skip-link"/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(app, /aria-disabled/);
});
