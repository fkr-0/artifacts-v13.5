export const FAVORITES_KEY = 'artifacts-v13.5:favorites:v1';

export function readFavorites(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id) : []);
  } catch {
    return new Set();
  }
}

export function writeFavorites(ids, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(FAVORITES_KEY, JSON.stringify([...ids].sort()));
    return true;
  } catch {
    return false;
  }
}

export function toggleFavorite(id, current, storage = globalThis.localStorage) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return { ids: next, persisted: writeFavorites(next, storage) };
}
