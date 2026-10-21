import { facetValues, filterArtifacts, resolveLaunchUrl, sortArtifacts, artifactUpdatedAt } from '../lib/discovery.mjs';
import { readFavorites, toggleFavorite } from '../lib/favorites.mjs';

const nodes = {
  catalog: document.querySelector('#catalog'),
  empty: document.querySelector('#empty'),
  search: document.querySelector('#search'),
  kind: document.querySelector('#kind-filter'),
  availability: document.querySelector('#availability-filter'),
  order: document.querySelector('#sort-order'),
  favoritesOnly: document.querySelector('#favorites-only'),
  clear: document.querySelector('#clear-filters'),
  status: document.querySelector('#status'),
  visible: document.querySelector('#visible-count'),
  total: document.querySelector('#total-count'),
  verified: document.querySelector('#verified-count'),
  types: document.querySelector('#type-count'),
  kindCount: document.querySelector('#kind-summary-count'),
  kindBar: document.querySelector('#kind-bar'),
  kindLegend: document.querySelector('#kind-legend'),
  lastDeploy: document.querySelector('#last-deploy'),
  build: document.querySelector('#build-date'),
  hubVersion: document.querySelector('#hub-version'),
  hubRevision: document.querySelector('#hub-revision'),
  hubCommits: document.querySelector('#hub-commits'),
  theme: document.querySelector('#theme-setting'),
  density: document.querySelector('#density-setting'),
  columns: document.querySelector('#columns-setting'),
  resetSettings: document.querySelector('#reset-settings'),
  template: document.querySelector('#artifact-card'),
};

const PREF_KEY = 'artifacts-v13.5:preferences:v1';
const DEFAULT_PREFS = Object.freeze({
  theme: 'lime', density: 'comfortable', columns: 'auto', order: 'recent',
});
const ALLOWED = Object.freeze({
  theme: ['lime', 'blue', 'amber', 'mono', 'light'],
  density: ['comfortable', 'compact'],
  columns: ['auto', 'wide'],
  order: ['recent', 'oldest', 'title'],
});
const TYPE_COLORS = ['#a4e57d', '#78bde5', '#efb45f', '#d2a9ef', '#e77f92', '#75cabb'];

let items = [];
let favorites = readFavorites();

function readPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    const preferences = { ...DEFAULT_PREFS };
    for (const key of Object.keys(DEFAULT_PREFS)) {
      if (ALLOWED[key].includes(stored?.[key])) preferences[key] = stored[key];
    }
    return preferences;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function applyPreferences(preferences) {
  document.documentElement.dataset.theme = preferences.theme;
  document.body.dataset.density = preferences.density;
  nodes.catalog.dataset.columns = preferences.columns;
  nodes.theme.value = preferences.theme;
  nodes.density.value = preferences.density;
  nodes.columns.value = preferences.columns;
  nodes.order.value = preferences.order;
}

function savePreferences() {
  const preferences = {
    theme: nodes.theme.value, density: nodes.density.value,
    columns: nodes.columns.value, order: nodes.order.value,
  };
  applyPreferences(preferences);
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
  } catch {
    // No storage or private browsing: in-memory preferences still function.
  }
}

function dateLabel(raw) {
  if (typeof raw !== 'string' || !Number.isFinite(Date.parse(raw))) return 'Not recorded';
  const date = new Date(raw);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function setDate(node, raw) {
  node.textContent = dateLabel(raw);
  if (typeof raw === 'string' && Number.isFinite(Date.parse(raw))) node.title = raw;
  else node.removeAttribute('title');
}

function renderStats(catalog) {
  const counts = new Map();
  for (const item of items) {
    const kind = item.kind || 'other';
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  nodes.verified.textContent = String(items.filter((item) => item.availability === 'verified').length);
  nodes.types.textContent = String(counts.size);
  nodes.kindCount.textContent = counts.size + ' kinds';
  nodes.kindBar.replaceChildren();
  nodes.kindLegend.replaceChildren();
  for (const [index, [kind, count]] of sorted.entries()) {
    const color = TYPE_COLORS[index % TYPE_COLORS.length];
    const segment = document.createElement('span');
    segment.style.flexGrow = String(count);
    segment.style.flexBasis = '0';
    segment.style.backgroundColor = color;
    segment.title = kind + ': ' + count;
    nodes.kindBar.append(segment);

    const legend = document.createElement('span');
    const swatch = document.createElement('i');
    swatch.style.backgroundColor = color;
    swatch.setAttribute('aria-hidden', 'true');
    legend.append(swatch, document.createTextNode(kind + ' ' + count));
    nodes.kindLegend.append(legend);
  }
  nodes.kindBar.setAttribute('aria-label', sorted.map(([kind, count]) => kind + ': ' + count).join(', ') || 'No artifact data');

  // A staged build is not a verified GitHub Pages deployment.
  setDate(nodes.lastDeploy, catalog.release?.lastDeployedAt);
  setDate(nodes.build, catalog.generatedAt);
  nodes.hubVersion.textContent = catalog.hub?.version || 'V13.5';
  const revision = catalog.hub?.revision;
  nodes.hubRevision.textContent = revision ? revision.slice(0, 10) + (catalog.hub?.dirty ? '*' : '') : 'Unavailable';
  nodes.hubRevision.title = revision
    ? (revision + (catalog.hub?.dirty ? ' (working tree has uncommitted hub changes)' : ''))
    : 'No Git provenance available';
  nodes.hubCommits.textContent = Number.isSafeInteger(catalog.hub?.commitCount)
    ? catalog.hub.commitCount.toLocaleString() + ' commits'
    : 'Not recorded';
  if (catalog.hub?.lastCommitAt) nodes.hubCommits.title = 'Last commit: ' + catalog.hub.lastCommitAt;
}

function fact(label, value) {
  const wrap = document.createElement('div');
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = label;
  dd.textContent = value == null || value === '' ? '—' : String(value);
  wrap.append(dt, dd);
  return wrap;
}

function fillSelect(node, values) {
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    node.append(option);
  }
}

function renderCard(item) {
  const card = nodes.template.content.firstElementChild.cloneNode(true);
  card.dataset.artifactId = item.id;
  card.querySelector('h2').textContent = item.title || item.id;
  card.querySelector('.description').textContent = item.description || 'No description supplied.';
  card.querySelector('.kind').textContent = item.kind || 'artifact';
  card.querySelector('.availability').textContent = item.availability || 'unknown';

  const tags = card.querySelector('.tags');
  for (const tag of item.tags || []) {
    const span = document.createElement('span');
    span.textContent = '#' + tag;
    tags.append(span);
  }

  const link = card.querySelector('.open');
  const url = resolveLaunchUrl(item);
  if (url) {
    link.href = url;
    if (/^https?:\/\//iu.test(item.url || '') || item.launch?.default === 'newWindow') {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  } else {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
    link.textContent = 'Not launchable';
  }

  const favorite = card.querySelector('.favorite');
  const isFavorite = favorites.has(item.id);
  favorite.setAttribute('aria-pressed', String(isFavorite));
  favorite.title = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
  favorite.querySelector('[aria-hidden]').textContent = isFavorite ? '★' : '☆';
  favorite.addEventListener('click', () => {
    const result = toggleFavorite(item.id, favorites);
    favorites = result.ids;
    render();
    nodes.status.textContent = result.persisted
      ? (favorites.has(item.id) ? item.title + ' added to Favorites.' : item.title + ' removed from Favorites.')
      : 'Favorites could not be saved in this browser.';
  });

  const facts = card.querySelector('.facts');
  const updated = artifactUpdatedAt(item);
  facts.append(
    fact('ID', item.id),
    fact('Status', item.status),
    fact('Version', item.version),
    fact('Source', item.sourceKind),
    fact('Build', item.buildMode),
    fact('Deployment', item.deployment?.state),
    fact('Git revision', item.git?.revision),
    fact('Last update', updated == null ? null : new Date(updated).toISOString()),
  );
  return card;
}

function render() {
  const filtered = filterArtifacts(items, {
    query: nodes.search.value,
    kind: nodes.kind.value,
    availability: nodes.availability.value,
    favoritesOnly: nodes.favoritesOnly.checked,
    favoriteIds: favorites,
  });
  const visible = sortArtifacts(filtered, nodes.order.value);
  nodes.catalog.replaceChildren(...visible.map(renderCard));
  nodes.empty.hidden = visible.length !== 0;
  nodes.visible.textContent = String(visible.length);
  nodes.total.textContent = String(items.length);
  nodes.status.textContent = visible.length + ' of ' + items.length + ' artifacts shown, ordered by ' +
    nodes.order.options[nodes.order.selectedIndex].textContent.toLowerCase() + '.';
}

async function load() {
  try {
    const response = await fetch('./catalog.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
    const catalog = await response.json();
    if (!Array.isArray(catalog.items)) throw new Error('catalog has no items array');
    items = catalog.items;
    fillSelect(nodes.kind, facetValues(items, 'kind'));
    fillSelect(nodes.availability, facetValues(items, 'availability'));
    renderStats(catalog);
    render();
  } catch (error) {
    nodes.status.textContent = 'Catalog unavailable: ' + error.message;
    nodes.empty.hidden = false;
    nodes.empty.querySelector('h2').textContent = 'Catalog unavailable';
    nodes.empty.querySelector('p').textContent = 'The V13.5 release catalog could not be loaded.';
  }
}

applyPreferences(readPreferences());
for (const node of [nodes.search, nodes.kind, nodes.availability, nodes.favoritesOnly]) {
  node.addEventListener(node === nodes.search ? 'input' : 'change', render);
}
nodes.order.addEventListener('change', () => { savePreferences(); render(); });
for (const node of [nodes.theme, nodes.density, nodes.columns]) {
  node.addEventListener('change', savePreferences);
}
nodes.resetSettings.addEventListener('click', () => {
  applyPreferences({ ...DEFAULT_PREFS });
  savePreferences();
  render();
});
nodes.clear.addEventListener('click', () => {
  nodes.search.value = '';
  nodes.kind.value = '';
  nodes.availability.value = '';
  nodes.favoritesOnly.checked = false;
  render();
  nodes.search.focus();
});

load();
