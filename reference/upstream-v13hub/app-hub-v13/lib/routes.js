const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

function deploymentBaseUrl(currentHref) {
  return new URL('./', new URL(currentHref));
}

function normalizedLocalPath(value) {
  const pathPart = value.split(/[?#]/, 1)[0].replace(/^\/+/, '');
  let decoded;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    return null;
  }
  if (decoded.includes('\\')) return null;
  const segments = decoded.split('/');
  if (segments.some((segment) => segment === '..')) return null;
  const normalized = segments.filter((segment) => segment && segment !== '.').join('/');
  return normalized || 'index.html';
}

export function resolveCatalogUrl(value, currentHref) {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  let current;
  try {
    current = new URL(currentHref);
  } catch {
    return null;
  }

  let parsed;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
      parsed = new URL(raw, current);
    } else {
      const base = deploymentBaseUrl(current);
      parsed = new URL(raw.replace(/^\/+/, ''), base);
      if (parsed.origin !== base.origin || !parsed.pathname.startsWith(base.pathname)) return null;
    }
  } catch {
    return null;
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) return null;
  return parsed.href;
}

export function localRoutePath(value) {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return null;
  return normalizedLocalPath(raw);
}

export function isRemoteCatalogUrl(value) {
  if (!value || typeof value !== 'string') return false;
  return /^https?:\/\//i.test(value.trim());
}

export function routeStateFor(item, { stagedPaths = new Set(), selfId = 'app-hub-v13' } = {}) {
  const sourceUrl = typeof item?.url === 'string' && item.url.trim() ? item.url.trim() : null;

  if (item?.availability === 'inline' || item?.sourceKind === 'inline') {
    return Object.freeze({
      state: 'inline',
      deployable: false,
      sourceUrl,
      outputUrl: null,
      path: null,
      reason: 'Inline metadata has no launch route.',
    });
  }

  if (sourceUrl && isRemoteCatalogUrl(sourceUrl)) {
    return Object.freeze({
      state: 'external',
      deployable: true,
      sourceUrl,
      outputUrl: sourceUrl,
      path: null,
      reason: 'External URL is intentionally outside the deployment bundle.',
    });
  }

  if (item?.id === selfId) {
    return Object.freeze({
      state: 'deployable',
      deployable: true,
      sourceUrl,
      outputUrl: './index.html',
      path: 'index.html',
      reason: 'Hub entrypoint is emitted by this build.',
    });
  }

  const path = localRoutePath(sourceUrl);
  if (item?.availability === 'source-only') {
    return Object.freeze({
      state: 'source-only',
      deployable: false,
      sourceUrl,
      outputUrl: null,
      path,
      reason: 'Catalog record is source-only and is not a launch endpoint in this deployment.',
    });
  }

  if (item?.availability === 'unavailable') {
    return Object.freeze({
      state: 'unavailable',
      deployable: false,
      sourceUrl,
      outputUrl: null,
      path,
      reason: 'Catalog record is explicitly unavailable in this deployment.',
    });
  }

  if (path && stagedPaths.has(path)) {
    return Object.freeze({
      state: 'deployable',
      deployable: true,
      sourceUrl,
      outputUrl: `./${path}`,
      path,
      reason: 'Local target is staged into this deployment.',
    });
  }

  return Object.freeze({
    state: 'unavailable',
    deployable: false,
    sourceUrl,
    outputUrl: null,
    path,
    reason: path
      ? 'Catalog target is not staged in this deployment.'
      : 'No deployable local target is recorded for this build.',
  });
}

export function reconcileCatalogForDeployment(document, options = {}) {
  const stagedPaths = options.stagedPaths || new Set();
  const items = document.items.map((item) => {
    const route = routeStateFor(item, { ...options, stagedPaths });
    if (route.state === 'external' || route.state === 'inline') {
      return {
        ...item,
        deployment: route,
      };
    }
    if (route.state === 'deployable') {
      return {
        ...item,
        url: route.outputUrl,
        deployment: route,
      };
    }
    return {
      ...item,
      url: null,
      deployment: route,
    };
  });

  const summary = { ...document.summary };
  const counts = {};
  for (const item of items)
    counts[item.availability || 'unknown'] = (counts[item.availability || 'unknown'] || 0) + 1;
  summary.total = items.length;
  summary.verified = counts.verified || 0;
  summary.provisional = counts.provisional || 0;
  summary.external = counts.external || 0;
  summary.inline = counts.inline || 0;
  summary.sourceOnly = counts['source-only'] || 0;
  summary.unavailable = counts.unavailable || 0;

  return {
    ...document,
    summary,
    deployment: {
      schemaVersion: 'v13hub.route-matrix/v1',
      supportedBase: './',
      generatedFrom: 'app-hub-v13/catalog.json',
    },
    items,
  };
}

export function buildRouteMatrix(document) {
  return {
    schemaVersion: 'v13hub.route-matrix/v1',
    supportedBase: './',
    entries: document.items.map((item) => ({
      id: item.id,
      availability: item.availability || 'unknown',
      state: item.deployment?.state || 'unknown',
      deployable: item.deployment?.deployable === true,
      sourceUrl: item.deployment?.sourceUrl ?? item.url ?? null,
      url: item.url ?? null,
      path: item.deployment?.path ?? localRoutePath(item.url),
      reason: item.deployment?.reason || 'No deployment route evidence.',
    })),
  };
}

export function findDeadInternalRoutes(routeMatrix, { stagedPaths = new Set() } = {}) {
  return (routeMatrix?.entries || []).filter(
    (entry) =>
      entry.state === 'deployable' &&
      (!entry.path || !stagedPaths.has(entry.path) || entry.url == null),
  );
}
