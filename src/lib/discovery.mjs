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
