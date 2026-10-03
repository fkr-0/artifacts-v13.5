const PEER_SIGNAL_TAGS = new Set(['peernet', 'p2p', 'multiplayer', 'collaborative', 'peer']);
const DECLARED_PEER_CAPABILITIES = new Set([
  'peernet',
  'p2p',
  'peer',
  'peer-transfer',
  'peer-collection',
  'multiplayer',
  'collaborative',
]);

export class CatalogContractError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CatalogContractError';
    this.details = details;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateCatalogUrlField(value, { index = -1 } = {}) {
  if (value == null) return;
  if (typeof value !== 'string')
    throw new CatalogContractError('Artifact url must be a string or null', { index });
  const raw = value.trim();
  if (!raw) return;
  if (
    [...raw].some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    })
  )
    throw new CatalogContractError('Artifact url contains control characters', { index });
  if (raw.startsWith('//') || raw.startsWith('\\\\'))
    throw new CatalogContractError('Artifact url must not use a protocol-relative target', {
      index,
    });
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      throw new CatalogContractError('Artifact url is malformed', { index });
    }
    if (!['http:', 'https:'].includes(parsed.protocol))
      throw new CatalogContractError(`Artifact url uses unsupported protocol: ${parsed.protocol}`, {
        index,
      });
    if (parsed.username || parsed.password)
      throw new CatalogContractError('Artifact url must not contain credentials', { index });
  }
}

export function validateArtifactRecord(item, { index = -1 } = {}) {
  if (!isRecord(item)) throw new CatalogContractError('Artifact must be an object', { index });
  if (!cleanString(item.id))
    throw new CatalogContractError('Artifact requires a non-empty id', { index });
  if (!cleanString(item.title))
    throw new CatalogContractError(`${item.id}: artifact requires a non-empty title`, { index });
  validateCatalogUrlField(item.url, { index });
  if (
    item.tags != null &&
    (!Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== 'string'))
  ) {
    throw new CatalogContractError(`${item.id}: tags must be an array of strings`, { index });
  }
  if (
    item.capabilities != null &&
    (!Array.isArray(item.capabilities) ||
      item.capabilities.some((capability) => typeof capability !== 'string'))
  ) {
    throw new CatalogContractError(`${item.id}: capabilities must be an array of strings`, {
      index,
    });
  }
  return item;
}

export function validateCatalogDocument(raw) {
  if (!isRecord(raw)) throw new CatalogContractError('Catalog must be an object');
  if (!Array.isArray(raw.items)) throw new CatalogContractError('Catalog requires an items array');
  const seen = new Set();
  raw.items.forEach((item, index) => {
    validateArtifactRecord(item, { index });
    const id = cleanString(item.id);
    if (seen.has(id)) throw new CatalogContractError(`Duplicate artifact id: ${id}`, { index });
    seen.add(id);
  });
  return raw;
}

const COLLISION_STRATEGIES = new Set(['reject', 'prefer-first', 'prefer-last']);

export function ingestCatalogDocuments(documents, { collision = 'reject' } = {}) {
  if (!Array.isArray(documents))
    throw new CatalogContractError('Catalog ingestion requires an array of documents');
  if (!COLLISION_STRATEGIES.has(collision)) {
    throw new CatalogContractError(`Unknown catalog collision strategy: ${collision}`);
  }

  const byId = new Map();
  documents.forEach((document, documentIndex) => {
    const raw = validateCatalogDocument(document);
    raw.items.forEach((item, itemIndex) => {
      const id = cleanString(item.id);
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, { item, documentIndex, itemIndex });
        return;
      }
      if (collision === 'reject') {
        throw new CatalogContractError(`Artifact version collision: ${id}`, {
          id,
          existingVersion: cleanString(existing.item.version) || null,
          incomingVersion: cleanString(item.version) || null,
          existingDocumentIndex: existing.documentIndex,
          incomingDocumentIndex: documentIndex,
        });
      }
      if (collision === 'prefer-last') byId.set(id, { item, documentIndex, itemIndex });
    });
  });

  return Object.freeze([...byId.values()].map(({ item }) => item));
}

export function peerSignalsFor(item) {
  const tags = (item.tags || []).map((tag) => String(tag).toLowerCase());
  return tags.filter((tag) => PEER_SIGNAL_TAGS.has(tag));
}

export function capabilityProfileFor(item) {
  const declared = [
    ...new Set(
      (Array.isArray(item?.capabilities) ? item.capabilities : [])
        .map((capability) => cleanString(capability))
        .filter(Boolean),
    ),
  ];
  const declaredPeer = declared.filter((capability) =>
    DECLARED_PEER_CAPABILITIES.has(capability.toLowerCase()),
  );
  const legacyPeerSignals = peerSignalsFor(item || {});
  const peerSignals = [...new Set([...declaredPeer, ...legacyPeerSignals])];
  const source = declaredPeer.length
    ? 'declared-peer'
    : legacyPeerSignals.length
      ? 'legacy-peer'
      : 'none';

  return Object.freeze({
    declared: Object.freeze(declared),
    declaredPeer: Object.freeze(declaredPeer),
    legacyPeerSignals: Object.freeze(legacyPeerSignals),
    peerSignals: Object.freeze(peerSignals),
    source,
    peerAware: peerSignals.length > 0,
  });
}

export function resolveCatalogFetchUrl(value, { currentHref } = {}) {
  if (!currentHref) throw new CatalogContractError('Catalog resolution requires currentHref');
  let current;
  let base;
  let parsed;
  try {
    current = new URL(currentHref);
    base = new URL('./', current);
    parsed = new URL(value, base);
  } catch {
    throw new CatalogContractError('Catalog URL is malformed');
  }
  if (!['http:', 'https:'].includes(parsed.protocol))
    throw new CatalogContractError(`Unsupported catalog URL protocol: ${parsed.protocol}`);
  if (parsed.username || parsed.password)
    throw new CatalogContractError('Catalog URL must not contain credentials');
  if (parsed.origin !== base.origin)
    throw new CatalogContractError('Catalog URL must remain same-origin');
  if (!parsed.pathname.startsWith(base.pathname))
    throw new CatalogContractError('Catalog URL escapes the deployment base');
  return parsed.href;
}

export function validateCatalogResponseUrl(responseUrl, { currentHref, requestUrl } = {}) {
  const effective = cleanString(responseUrl);
  if (!effective) throw new CatalogContractError('Catalog response must expose its final URL');
  let reported;
  try {
    reported = new URL(effective);
  } catch {
    throw new CatalogContractError('Catalog response final URL must be absolute');
  }
  const finalUrl = resolveCatalogFetchUrl(reported.href, { currentHref });
  const requested = resolveCatalogFetchUrl(requestUrl, { currentHref });
  if (new URL(finalUrl).origin !== new URL(requested).origin)
    throw new CatalogContractError('Catalog response redirected across origins');
  return finalUrl;
}

export function provenanceFor(item) {
  const git = isRecord(item.git) ? item.git : {};
  return Object.freeze({
    sourceKind: cleanString(item.sourceKind) || 'unknown',
    gitMode: cleanString(item.gitMode) || 'unknown',
    gitBasis: cleanString(git.basis) || null,
    revision: cleanString(git.revision) || null,
    path: cleanString(git.path) || null,
    changedAt: cleanString(item.changedAt) || cleanString(git.changedAt) || null,
    receiptPresent: Boolean(item.receipt),
  });
}

function verificationEvidenceFor(item) {
  const receipt = isRecord(item?.receipt) ? item.receipt : null;
  if (!receipt) return Object.freeze({ supported: false, basis: null });
  const fields = ['verification', 'releaseHealth'];
  for (const field of fields) {
    if (cleanString(receipt[field]).toLowerCase() === 'verified') {
      return Object.freeze({ supported: true, basis: `receipt.${field}` });
    }
  }
  return Object.freeze({ supported: false, basis: null });
}

function receiptAxis(receipt, field) {
  if (!receipt) return Object.freeze({ state: 'unknown', basis: null });
  if (cleanString(receipt[field]).toLowerCase() === 'verified') {
    return Object.freeze({ state: 'verified', basis: `receipt.${field}` });
  }
  return Object.freeze({ state: 'unknown', basis: null });
}

export function evidenceAxesFor(item) {
  const receipt = isRecord(item?.receipt) ? item.receipt : null;
  const releaseVerification = verificationEvidenceFor(item);
  return Object.freeze({
    sourceOwnership: receiptAxis(receipt, 'sourceOwnership'),
    validation: receiptAxis(receipt, 'validation'),
    receipt: Object.freeze({
      state: releaseVerification.supported
        ? 'verified'
        : receipt
          ? 'present-unverified'
          : 'unknown',
      basis: releaseVerification.basis,
    }),
    runtimeNetwork: Object.freeze({ state: 'unknown', basis: null }),
  });
}

export function healthFor(item) {
  const availability = cleanString(item.availability) || 'unknown';
  const labels = {
    verified: 'Verified release',
    provisional: 'Provisional release',
    'source-only': 'Source only',
    unavailable: 'Unavailable in this deployment',
    external: 'External reference',
    inline: 'Inline record',
    unknown: 'Unclassified',
  };
  const provenance = provenanceFor(item);
  const verification = verificationEvidenceFor(item);
  const evidenceAxes = evidenceAxesFor(item);
  const state = availability === 'verified' && !verification.supported ? 'unknown' : availability;
  return Object.freeze({
    state,
    recordedState: availability,
    label:
      availability === 'verified' && !verification.supported
        ? 'Verification unknown'
        : labels[state] || state,
    hasRevision: Boolean(provenance.revision),
    hasReceipt: provenance.receiptPresent,
    verificationSupported: verification.supported,
    verificationBasis: verification.basis,
    evidenceAxes,
    evidenceLevel: provenance.receiptPresent
      ? 'receipt-present'
      : provenance.revision
        ? 'revision-only'
        : 'metadata-only',
  });
}

export function normalizeArtifact(item, { recordKey, origin = 'catalog', sourceLabel = '' } = {}) {
  validateArtifactRecord(item);
  const tags = [...new Set((item.tags || []).map((tag) => String(tag).trim()).filter(Boolean))];
  const normalized = {
    ...item,
    id: cleanString(item.id),
    title: cleanString(item.title),
    description: cleanString(item.description) || cleanString(item.text),
    tags,
    recordKey: recordKey || `${origin}:${cleanString(item.id)}`,
    recordOrigin: origin,
    sourceLabel,
  };
  normalized.capabilityProfile = capabilityProfileFor(normalized);
  normalized.capabilities = normalized.capabilityProfile.declared;
  normalized.peerSignals = normalized.capabilityProfile.peerSignals;
  normalized.peerAware = normalized.capabilityProfile.peerAware;
  normalized.provenance = provenanceFor(normalized);
  normalized.health = healthFor(normalized);
  return Object.freeze(normalized);
}

export function summarizeCatalog(items) {
  const summary = {
    total: items.length,
    peerAware: 0,
    declaredPeerAware: 0,
    legacyPeerAware: 0,
    withRevision: 0,
    withReceipt: 0,
    byKind: {},
    byAvailability: {},
  };
  for (const item of items) {
    if (item.peerAware) summary.peerAware += 1;
    if (item.capabilityProfile?.source === 'declared-peer') summary.declaredPeerAware += 1;
    if (item.capabilityProfile?.source === 'legacy-peer') summary.legacyPeerAware += 1;
    if (item.provenance?.revision) summary.withRevision += 1;
    if (item.provenance?.receiptPresent) summary.withReceipt += 1;
    const kind = item.kind || 'unknown';
    const availability = item.availability || 'unknown';
    summary.byKind[kind] = (summary.byKind[kind] || 0) + 1;
    summary.byAvailability[availability] = (summary.byAvailability[availability] || 0) + 1;
  }
  return summary;
}

function searchText(item) {
  return [
    item.id,
    item.title,
    item.description,
    item.kind,
    item.status,
    item.availability,
    item.sourceKind,
    item.recordOrigin,
    item.provenance?.gitBasis,
    item.provenance?.revision,
    item.provenance?.path,
    item.health?.evidenceLevel,
    item.capabilityProfile?.source,
    ...(item.tags || []),
    ...(item.capabilities || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

function changedTimestamp(item) {
  const parsed = Date.parse(item.changedAt || item.provenance?.changedAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function filterArtifacts(items, filters = {}) {
  const queryTokens = String(filters.query || '')
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const kind = filters.kind || '';
  const availability = filters.availability || '';
  const evidence = filters.evidence || '';
  const origin = filters.origin || '';
  const capabilitySource = filters.capabilitySource || '';
  const selectedTags = [
    ...new Set(
      (Array.isArray(filters.tags) ? filters.tags : [])
        .map((tag) => cleanString(tag))
        .filter(Boolean),
    ),
  ];
  const tagMode = filters.tagMode === 'all' ? 'all' : 'any';
  const lens = filters.lens || 'discover';
  const collectionKeys = filters.collectionKeys || new Set();

  const filtered = items.filter((item) => {
    if (kind && item.kind !== kind) return false;
    if (availability && item.availability !== availability) return false;
    if (evidence && item.health?.evidenceLevel !== evidence) return false;
    if (origin && item.recordOrigin !== origin) return false;
    if (capabilitySource && item.capabilityProfile?.source !== capabilitySource) return false;
    if (selectedTags.length) {
      const itemTags = new Set(item.tags || []);
      const matches =
        tagMode === 'all'
          ? selectedTags.every((tag) => itemTags.has(tag))
          : selectedTags.some((tag) => itemTags.has(tag));
      if (!matches) return false;
    }
    if (lens === 'peer' && !item.peerAware) return false;
    if (lens === 'collection' && !collectionKeys.has(item.recordKey)) return false;
    if (queryTokens.length && !queryTokens.every((token) => searchText(item).includes(token)))
      return false;
    return true;
  });

  const sort = filters.sort || 'recent';
  return filtered.toSorted((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    if (sort === 'evidence') {
      const evidenceRank = { 'receipt-present': 0, 'revision-only': 1, 'metadata-only': 2 };
      return (
        (evidenceRank[a.health?.evidenceLevel] ?? 9) -
          (evidenceRank[b.health?.evidenceLevel] ?? 9) || a.title.localeCompare(b.title)
      );
    }
    if (sort === 'health') {
      const rank = {
        verified: 0,
        provisional: 1,
        'source-only': 2,
        unavailable: 3,
        inline: 4,
        external: 5,
        unknown: 6,
      };
      return (
        (rank[a.health.state] ?? 9) - (rank[b.health.state] ?? 9) || a.title.localeCompare(b.title)
      );
    }
    return changedTimestamp(b) - changedTimestamp(a) || a.title.localeCompare(b.title);
  });
}

export function uniqueFacetValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b)),
  );
}
