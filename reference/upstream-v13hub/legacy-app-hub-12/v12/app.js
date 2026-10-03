function isSourceTreeRuntime() {
  return window.location.pathname.includes('/apps/app-hub-v12/');
}

async function loadArtifactBridge() {
  const candidates = isSourceTreeRuntime()
    ? ['../../packages/artifact-bridge/bridge.js', './vendor/artifact-bridge/bridge.js']
    : ['./vendor/artifact-bridge/bridge.js', '../../packages/artifact-bridge/bridge.js'];
  let firstError;
  for (const candidate of candidates) {
    try {
      return await import(candidate);
    } catch (error) {
      firstError ||= error;
    }
  }
  throw new AggregateError(
    [firstError].filter(Boolean),
    'Artifact bridge is unavailable from both the staged vendor path and repository source path',
  );
}

const { createArtifactHostBridge } = await loadArtifactBridge();
const startedAt = performance.now();
const catalogNode = document.querySelector('#catalog');
const emptyNode = document.querySelector('#empty');
const summaryNode = document.querySelector('#summary');
const statesNode = document.querySelector('#states');
const searchNode = document.querySelector('#search');
const kindFilterNode = document.querySelector('#kind-filter');
const availabilityFilterNode = document.querySelector('#availability-filter');
const clearFiltersNode = document.querySelector('#clear-filters');
const template = document.querySelector('#card-template');
const bridge = createArtifactHostBridge();
let catalog = { items: [], summary: {}, build: {} };

bridge.on('artifact.ready', (payload) => console.info('artifact ready', payload));
window.addEventListener('pagehide', () => bridge.close(), { once: true });

function formatDate(value, options = {}) {
  if (!value || Number.isNaN(Date.parse(value))) return 'unknown';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    ...options,
  }).format(new Date(value));
}

function fact(label, value) {
  const wrapper = document.createElement('div');
  const term = document.createElement('dt');
  const detail = document.createElement('dd');
  term.textContent = label;
  detail.textContent = value || '—';
  wrapper.append(term, detail);
  return wrapper;
}

function resolveCatalogUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith('/')) return value;
  const marker = '/apps/app-hub-v12/';
  const markerIndex = window.location.pathname.indexOf(marker);
  const deploymentBase = markerIndex >= 0 ? window.location.pathname.slice(0, markerIndex + 1) : '/';
  return new URL(`${deploymentBase}${value.slice(1)}`, window.location.origin).href;
}

function renderStates() {
  const counts = new Map();
  for (const item of catalog.items) counts.set(item.availability, (counts.get(item.availability) || 0) + 1);
  statesNode.replaceChildren(...[...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([state, count]) => {
    const node = document.createElement('span');
    node.className = 'state';
    node.dataset.state = state;
    node.append(document.createTextNode(`${state} `));
    const strong = document.createElement('strong');
    strong.textContent = count;
    node.append(strong);
    return node;
  }));
}

function fillSelect(node, values) {
  const current = node.value;
  const first = node.firstElementChild.cloneNode(true);
  node.replaceChildren(first, ...[...new Set(values.filter(Boolean))].sort().map((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    return option;
  }));
  node.value = [...node.options].some((option) => option.value === current) ? current : '';
}

function matchingItems() {
  const query = searchNode.value.trim().toLowerCase();
  const kind = kindFilterNode.value;
  const availability = availabilityFilterNode.value;
  return catalog.items.filter((item) => {
    if (kind && item.kind !== kind) return false;
    if (availability && item.availability !== availability) return false;
    if (!query) return true;
    return [
      item.title,
      item.description,
      item.kind,
      item.status,
      item.availability,
      item.version,
      ...(item.tags || []),
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
  });
}

function updateRuntimeStats(visible) {
  document.querySelector('#visible-count').textContent = visible;
  document.querySelector('#artifact-count').textContent = catalog.summary.total || catalog.items.length;
  document.querySelector('#generated-at').textContent = formatDate(catalog.generatedAt, { hour: '2-digit', minute: '2-digit' });
  document.querySelector('#load-ms').textContent = `${Math.max(0, Math.round(performance.now() - startedAt))} ms`;
  const bytes = performance.memory?.usedJSHeapSize;
  document.querySelector('#memory-stat').textContent = Number.isFinite(bytes)
    ? `JS heap ${(bytes / 1024 / 1024).toFixed(1)} MiB`
    : 'memory n/a';
}

function render() {
  const items = matchingItems();
  const cards = items.map((item) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.artifactId = item.id;
    node.querySelector('h2').textContent = item.title;
    node.querySelector('.description').textContent = item.description || item.text || 'No description supplied.';
    const availability = node.querySelector('.availability');
    availability.textContent = item.availability;
    availability.dataset.state = item.availability;
    node.querySelector('.version').textContent = item.version ? `v${item.version.replace(/^v/, '')}` : '';
    const changed = node.querySelector('.changed');
    changed.textContent = item.changedAt ? formatDate(item.changedAt) : 'date unknown';
    if (item.changedAt) changed.dateTime = item.changedAt;
    changed.title = item.git?.basis ? `Git date basis: ${item.git.basis}` : '';
    node.querySelector('.facts').append(
      fact('product', item.kind),
      fact('source', item.sourceKind),
      fact('build', item.buildMode),
      fact('status', item.status),
    );
    node.querySelector('.tags').replaceChildren(...(item.tags || []).map((tag) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = `#${tag}`;
      return span;
    }));
    const actions = node.querySelector('.actions');
    if (item.url) {
      const link = document.createElement('a');
      link.href = resolveCatalogUrl(item.url);
      link.textContent = item.kind === 'download' ? 'Open download' : 'Launch artifact';
      if (item.launch?.default === 'newWindow' || item.kind === 'link') {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      actions.append(link);
    } else {
      const unavailable = document.createElement('span');
      unavailable.className = 'unavailable';
      unavailable.textContent = item.kind === 'text' ? 'Catalog information' : 'Release not staged';
      actions.append(unavailable);
    }
    return node;
  });
  catalogNode.replaceChildren(...cards);
  emptyNode.hidden = cards.length !== 0;
  updateRuntimeStats(cards.length);
}

function renderHeader() {
  const version = catalog.build?.portfolioVersion || catalog.items.find((item) => item.id === 'app-hub-v12')?.version || 'dev';
  document.querySelector('#portfolio-version').textContent = String(version).startsWith('v') ? version : `v${version}`;
  document.querySelector('#build-date').textContent = formatDate(catalog.generatedAt, { hour: '2-digit', minute: '2-digit' });
  summaryNode.textContent = `${catalog.summary.total || catalog.items.length} artifacts · ${catalog.summary.verified || 0} verified · ${catalog.summary.provisional || 0} provisional`;
}

async function loadCatalog() {
  const candidates = isSourceTreeRuntime()
    ? ['./catalog.json', '../../registry/generated/catalog.json']
    : ['../../catalog/catalog.json', './catalog.json'];
  let error;
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const candidate = await response.json();
      if (!Array.isArray(candidate.items)) throw new Error('catalog has no items array');
      catalog = candidate;
      renderHeader();
      renderStates();
      fillSelect(kindFilterNode, catalog.items.map((item) => item.kind));
      fillSelect(availabilityFilterNode, catalog.items.map((item) => item.availability));
      render();
      return;
    } catch (candidateError) {
      error = candidateError;
    }
  }
  summaryNode.textContent = `Catalog unavailable: ${error?.message || 'unknown error'}`;
  emptyNode.hidden = false;
  emptyNode.textContent = 'The release catalog could not be loaded.';
  updateRuntimeStats(0);
}

for (const node of [searchNode, kindFilterNode, availabilityFilterNode]) {
  node.addEventListener(node === searchNode ? 'input' : 'change', render);
}
clearFiltersNode.addEventListener('click', () => {
  searchNode.value = '';
  kindFilterNode.value = '';
  availabilityFilterNode.value = '';
  searchNode.focus();
  render();
});

loadCatalog();
