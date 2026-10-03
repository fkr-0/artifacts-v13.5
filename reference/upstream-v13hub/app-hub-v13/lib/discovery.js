const DEFAULT_TOPIC_LIMIT = 14;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteChangedAt(item) {
  const value = item?.changedAt || item?.provenance?.changedAt || item?.git?.changedAt;
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Build deterministic topic facets from recorded tags. Tags are metadata only: the
 * facet does not infer capabilities, categories, popularity, or trust.
 */
export function collectTopicFacets(items, { limit = DEFAULT_TOPIC_LIMIT } = {}) {
  if (!Array.isArray(items)) throw new TypeError('Topic facets require an items array');
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new RangeError('Topic facet limit must be a positive safe integer');
  }

  const counts = new Map();
  for (const item of items) {
    const unique = new Set(
      (Array.isArray(item?.tags) ? item.tags : []).map(cleanString).filter(Boolean),
    );
    for (const tag of unique) counts.set(tag, (counts.get(tag) || 0) + 1);
  }

  return Object.freeze(
    [...counts.entries()]
      .map(([tag, count]) => Object.freeze({ tag, count }))
      .toSorted((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, limit),
  );
}

/**
 * Present the evidence ladder without collapsing distinct kinds of proof into a
 * score. The final stage is one runtime-level fact, not an artifact count.
 */
export function buildEvidenceLadder(items, peerRuntime = null) {
  if (!Array.isArray(items)) throw new TypeError('Evidence ladder requires an items array');

  let revisionCount = 0;
  let receiptCount = 0;
  let latestTimestamp = null;
  let latestChangedAt = null;

  for (const item of items) {
    const revision = item?.provenance?.revision || item?.git?.revision;
    const receiptPresent =
      typeof item?.provenance?.receiptPresent === 'boolean'
        ? item.provenance.receiptPresent
        : Boolean(item?.receipt);
    if (revision) revisionCount += 1;
    if (receiptPresent) receiptCount += 1;
    const timestamp = finiteChangedAt(item);
    if (timestamp != null && (latestTimestamp == null || timestamp > latestTimestamp)) {
      latestTimestamp = timestamp;
      latestChangedAt = new Date(timestamp).toISOString();
    }
  }

  const runtimeProof = peerRuntime?.connected === true && Boolean(peerRuntime?.proof);
  return Object.freeze({
    total: items.length,
    latestChangedAt,
    stages: Object.freeze([
      Object.freeze({
        id: 'metadata',
        label: 'catalog metadata',
        count: items.length,
        unit: 'records',
      }),
      Object.freeze({
        id: 'revision',
        label: 'revision evidence',
        count: revisionCount,
        unit: 'records',
      }),
      Object.freeze({
        id: 'receipt',
        label: 'receipt evidence',
        count: receiptCount,
        unit: 'records',
      }),
      Object.freeze({
        id: 'peer-runtime',
        label: 'live peer proof',
        count: runtimeProof ? 1 : 0,
        unit: 'runtime',
      }),
    ]),
  });
}
