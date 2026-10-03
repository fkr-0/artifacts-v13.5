import assert from 'node:assert/strict';
import test from 'node:test';
import { facetValues, filterArtifacts, resolveLaunchUrl } from '../../src/lib/discovery.mjs';

const items = [
  { id: 'meme-lab', title: 'Meme Lab', description: 'Image template generator', kind: 'application', availability: 'provisional', tags: ['graphics', 'meme'], url: '/meme-lab/meme-lab.html' },
  { id: 'guide', title: 'Guide', description: 'Docs', kind: 'document', availability: 'source-only', tags: ['docs'], url: null },
];

test('search and facets match V12-style discovery expectations', () => {
  assert.deepEqual(filterArtifacts(items, { query: 'graphics' }).map((x) => x.id), ['meme-lab']);
  assert.deepEqual(filterArtifacts(items, { kind: 'document' }).map((x) => x.id), ['guide']);
  assert.deepEqual(facetValues(items, 'kind'), ['application', 'document']);
});

test('favorites are an optional filter rather than launch authority', () => {
  assert.deepEqual(filterArtifacts(items, { favoritesOnly: true, favoriteIds: new Set(['meme-lab']) }).map((x) => x.id), ['meme-lab']);
  assert.equal(filterArtifacts(items).length, 2);
});

test('launch URLs resolve independently of favorite state', () => {
  assert.equal(resolveLaunchUrl(items[0], { origin: 'https://artifacts.fkr.dev' }), 'https://artifacts.fkr.dev/meme-lab/meme-lab.html');
});
