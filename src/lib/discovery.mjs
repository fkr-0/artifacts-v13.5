function text(value) {
  return typeof value === 'string' ? value : '';
}

export function normalizeQuery(value) {
  return text(value).trim().toLocaleLowerCase();
}

export function searchableText(item) {
  return [
    item.title,
    item.description,
    item.kind,
    item.status,
    item.availability,
    item.version,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].map(text).filter(Boolean).join(' ').toLocaleLowerCase();
}

export function filterArtifacts(items, {
  query = '',
  kind = '',
  availability = '',
  favoritesOnly = false,
  favoriteIds = new Set(),
} = {}) {
  const q = normalizeQuery(query);
  return items.filter((item) => {
    if (kind && item.kind !== kind) return false;
    if (availability && item.availability !== availability) return false;
    if (favoritesOnly && !favoriteIds.has(item.id)) return false;
    if (q && !searchableText(item).includes(q)) return false;
    return true;
  });
}

// Catalog provenance timestamps represent the included artifact revision, not
// a browser's access time or the hub's build time. Invalid/missing dates sort last.
export function artifactUpdatedAt(item) {
  for (const raw of [item?.git?.changedAt, item?.changedAt, item?.updatedAt]) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const value = Date.parse(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function sortArtifacts(items, order = 'recent') {
  const direction = order === 'oldest' ? 1 : -1;
  const byTitle = (a, b) => String(a.title || a.id || '').localeCompare(
    String(b.title || b.id || ''), undefined, { sensitivity: 'base' },
  ) || String(a.id || '').localeCompare(String(b.id || ''));
  return [...items].sort((a, b) => {
    if (order === 'title') return byTitle(a, b);
    const at = artifactUpdatedAt(a);
    const bt = artifactUpdatedAt(b);
    if (at == null && bt != null) return 1;
    if (bt == null && at != null) return -1;
    if (at != null && bt != null && at !== bt) return (at - bt) * direction;
    return byTitle(a, b);
  });
}

export function facetValues(items, key) {
  return [...new Set(items.map((item) => item && item[key]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

export function resolveLaunchUrl(item, locationLike = globalThis.location) {
  if (!item || typeof item.url !== 'string' || !item.url.trim()) return null;
  if (/^https?:\/\//iu.test(item.url)) return item.url;
  if (!item.url.startsWith('/')) return item.url;
  const origin = locationLike && locationLike.origin ? locationLike.origin : 'http://localhost';
  return new URL(item.url, origin).href;
}
