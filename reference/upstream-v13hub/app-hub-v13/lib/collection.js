import { validateArtifactRecord } from './catalog.js';

export const COLLECTION_SCHEMA = 'v13hub.collection/v1';
const DEFAULT_KEY = 'v13hub:collection:v1';
const DEFAULT_PERMISSION_KEY = 'v13hub:collection-permission:v1';
const MAX_IMPORT_ITEMS = 500;

export class CollectionStorageError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'CollectionStorageError';
  }
}

function emptyCollection() {
  return { schemaVersion: COLLECTION_SCHEMA, pinnedIds: [], imports: [] };
}

function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function importRecordKey(sourceName, artifactId) {
  return `import:${encodeURIComponent(sourceName)}:${encodeURIComponent(artifactId)}`;
}

function normalizeStored(value) {
  if (!value || value.schemaVersion !== COLLECTION_SCHEMA) return emptyCollection();
  const imports = new Map();
  for (const entry of Array.isArray(value.imports) ? value.imports : []) {
    try {
      if (!entry || typeof entry.sourceName !== 'string' || !entry.sourceName.trim()) continue;
      validateArtifactRecord(entry.artifact);
      const sourceName = entry.sourceName.trim();
      const recordKey = importRecordKey(sourceName, entry.artifact.id.trim());
      imports.set(recordKey, {
        recordKey,
        sourceName,
        importedAt: Number.isFinite(entry.importedAt) ? entry.importedAt : null,
        artifact: safeClone(entry.artifact),
      });
    } catch {
      // Corrupt imported records are isolated instead of poisoning the collection.
    }
  }
  return {
    schemaVersion: COLLECTION_SCHEMA,
    pinnedIds: [
      ...new Set(
        (Array.isArray(value.pinnedIds) ? value.pinnedIds : [])
          .filter((id) => typeof id === 'string' && id.trim())
          .map((id) => id.trim()),
      ),
    ],
    imports: [...imports.values()],
  };
}

function validateImportBatch({ sourceName, items }) {
  if (typeof sourceName !== 'string' || !sourceName.trim()) {
    throw new Error('Local import requires a non-empty source name.');
  }
  if (!Array.isArray(items)) throw new Error('Local import requires an items array.');
  if (items.length > MAX_IMPORT_ITEMS) {
    throw new Error(`Local import is limited to ${MAX_IMPORT_ITEMS} artifacts per file.`);
  }

  const seen = new Set();
  const validated = items.map((artifact, index) => {
    validateArtifactRecord(artifact, { index });
    const id = artifact.id.trim();
    if (seen.has(id)) throw new Error(`Duplicate artifact id in local import: ${id}`);
    seen.add(id);
    return safeClone(artifact);
  });
  return { sourceName: sourceName.trim(), items: validated };
}

export function parseLocalArtifactDocument(text, { sourceName = 'local.json' } = {}) {
  const parsed = JSON.parse(text);
  const records = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.items)
      ? parsed.items
      : [parsed];
  if (records.length > MAX_IMPORT_ITEMS)
    throw new Error(`Local import is limited to ${MAX_IMPORT_ITEMS} artifacts per file.`);
  const seen = new Set();
  const items = records.map((item, index) => {
    validateArtifactRecord(item, { index });
    const id = item.id.trim();
    if (seen.has(id)) throw new Error(`Duplicate artifact id in local file: ${id}`);
    seen.add(id);
    return safeClone(item);
  });
  return Object.freeze({ sourceName, items });
}

export function createCollectionStore({
  storage = globalThis.localStorage,
  key = DEFAULT_KEY,
  permissionKey = DEFAULT_PERMISSION_KEY,
  now = () => Date.now(),
} = {}) {
  const permissionStatus = () => {
    if (!storage || typeof storage.getItem !== 'function') {
      return { available: false, permitted: false };
    }
    try {
      return {
        available: true,
        permitted: storage.getItem(permissionKey) === 'granted',
      };
    } catch {
      return { available: false, permitted: false };
    }
  };

  const requireStorageMethod = (name) => {
    if (!storage || typeof storage[name] !== 'function') {
      throw new CollectionStorageError('Collection storage is unavailable');
    }
    return storage[name].bind(storage);
  };

  const requirePermission = () => {
    const status = permissionStatus();
    if (!status.available) throw new CollectionStorageError('Collection storage is unavailable');
    if (!status.permitted) {
      throw new CollectionStorageError('Local collection persistence is not enabled');
    }
  };

  const read = () => {
    try {
      return normalizeStored(JSON.parse(storage?.getItem?.(key) || 'null'));
    } catch {
      return emptyCollection();
    }
  };

  const write = (state) => {
    requirePermission();
    const normalized = normalizeStored(state);
    try {
      requireStorageMethod('setItem')(key, JSON.stringify(normalized));
    } catch (error) {
      if (error instanceof CollectionStorageError) throw error;
      throw new CollectionStorageError('Collection storage write failed', error);
    }
    return safeClone(normalized);
  };

  const setPinned = (id, pinned) => {
    if (typeof id !== 'string' || !id.trim()) return read();
    const cleanId = id.trim();
    const state = read();
    const has = state.pinnedIds.includes(cleanId);
    if (pinned && !has) state.pinnedIds.push(cleanId);
    if (!pinned && has) state.pinnedIds = state.pinnedIds.filter((entry) => entry !== cleanId);
    return write(state);
  };

  return Object.freeze({
    status() {
      return Object.freeze({ ...permissionStatus() });
    },
    enable() {
      try {
        requireStorageMethod('setItem')(permissionKey, 'granted');
      } catch (error) {
        if (error instanceof CollectionStorageError) throw error;
        throw new CollectionStorageError('Collection permission write failed', error);
      }
      const status = permissionStatus();
      if (!status.available || !status.permitted) {
        throw new CollectionStorageError('Collection permission could not be verified');
      }
      return Object.freeze({ ...status });
    },
    snapshot() {
      return safeClone(read());
    },
    isPinned(id) {
      return typeof id === 'string' && read().pinnedIds.includes(id.trim());
    },
    pin(id) {
      return setPinned(id, true);
    },
    unpin(id) {
      return setPinned(id, false);
    },
    togglePinned(id) {
      if (typeof id !== 'string' || !id.trim()) return read();
      const cleanId = id.trim();
      const state = read();
      return setPinned(cleanId, !state.pinnedIds.includes(cleanId));
    },
    importLocal(request) {
      const { sourceName, items } = validateImportBatch(request || {});
      const state = read();
      const importedAt = now();
      for (const artifact of items) {
        const recordKey = importRecordKey(sourceName, artifact.id.trim());
        const entry = { recordKey, sourceName, importedAt, artifact: safeClone(artifact) };
        const existingIndex = state.imports.findIndex(
          (candidate) => candidate.recordKey === recordKey,
        );
        if (existingIndex >= 0) state.imports[existingIndex] = entry;
        else state.imports.push(entry);
      }
      return write(state);
    },
    removeImport(recordKey) {
      const state = read();
      state.imports = state.imports.filter((entry) => entry.recordKey !== recordKey);
      return write(state);
    },
    clear() {
      requirePermission();
      try {
        requireStorageMethod('removeItem')(key);
      } catch (error) {
        if (error instanceof CollectionStorageError) throw error;
        throw new CollectionStorageError('Collection storage clear failed', error);
      }
      return emptyCollection();
    },
    revoke() {
      // Data is removed before permission. If clearing data fails, permission remains granted so
      // the UI cannot truthfully claim a disable+clear succeeded while persisted data survives.
      try {
        requireStorageMethod('removeItem')(key);
      } catch (error) {
        if (error instanceof CollectionStorageError) throw error;
        throw new CollectionStorageError('Collection storage clear failed', error);
      }
      try {
        requireStorageMethod('removeItem')(permissionKey);
      } catch (error) {
        if (error instanceof CollectionStorageError) throw error;
        throw new CollectionStorageError('Collection permission revoke failed', error);
      }
      return Object.freeze({ ...permissionStatus() });
    },
    exportDocument() {
      const state = read();
      return JSON.stringify({ ...state, exportedAt: new Date(now()).toISOString() }, null, 2);
    },
  });
}

export function collectionRecordKeys(snapshot) {
  return new Set([
    ...(snapshot.pinnedIds || []).map((id) => `catalog:${id}`),
    ...(snapshot.imports || []).map((entry) => entry.recordKey),
  ]);
}

/**
 * Reconcile references without fabricating artifact metadata for ids that disappeared from the
 * current catalog. Missing pins remain visible as references the user chose to keep.
 */
export function reconcileCollection(snapshot, catalogItems = []) {
  const knownCatalogIds = new Set(
    (Array.isArray(catalogItems) ? catalogItems : [])
      .map((item) => (typeof item?.id === 'string' ? item.id.trim() : ''))
      .filter(Boolean),
  );
  const pinnedIds = Array.isArray(snapshot?.pinnedIds) ? snapshot.pinnedIds : [];
  const presentPinnedIds = pinnedIds.filter((id) => knownCatalogIds.has(id));
  const missingPinnedIds = pinnedIds.filter((id) => !knownCatalogIds.has(id));
  return Object.freeze({
    pinnedCount: pinnedIds.length,
    importCount: Array.isArray(snapshot?.imports) ? snapshot.imports.length : 0,
    presentPinnedIds: Object.freeze([...presentPinnedIds]),
    missingPinnedIds: Object.freeze([...missingPinnedIds]),
  });
}
