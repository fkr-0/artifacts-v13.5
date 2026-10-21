import assert from 'node:assert/strict';
import test from 'node:test';
import { artifactUpdatedAt, facetValues, filterArtifacts, resolveLaunchUrl, sortArtifacts } from '../../src/lib/discovery.mjs';

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

test('artifact order prioritizes Git provenance, with undated entries last', () => {
  const candidates = [
    { id: 'undated', title: 'A missing', changedAt: null },
    { id: 'older', title: 'Z old', changedAt: '2026-03-04T10:00:00Z' },
    { id: 'newer', title: 'A new', changedAt: '2026-05-02T10:00:00Z',
      git: { changedAt: '2026-10-20T10:00:00Z' } },
    { id: 'invalid', title: 'B missing', changedAt: 'invalid-date' },
  ];
  assert.equal(artifactUpdatedAt(candidates[2]), Date.parse('2026-10-20T10:00:00Z'));
  assert.equal(artifactUpdatedAt(candidates[3]), null);
  assert.deepEqual(sortArtifacts(candidates).map((x) => x.id),
    ['newer', 'older', 'undated', 'invalid']);
  assert.deepEqual(sortArtifacts(candidates, 'oldest').map((x) => x.id),
    ['older', 'newer', 'undated', 'invalid']);
  assert.deepEqual(sortArtifacts(candidates, 'title').map((x) => x.id),
    ['undated', 'newer', 'invalid', 'older']);
  assert.equal(candidates[0].id, 'undated', 'sorting does not mutate source');
});

test('launch URLs resolve independently of favorite state', () => {
  assert.equal(resolveLaunchUrl(items[0], { origin: 'https://artifacts.fkr.dev' }), 'https://artifacts.fkr.dev/meme-lab/meme-lab.html');
});
