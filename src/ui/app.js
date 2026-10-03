import { facetValues, filterArtifacts, resolveLaunchUrl } from '../lib/discovery.mjs';
import { readFavorites, toggleFavorite } from '../lib/favorites.mjs';

const nodes = {
  catalog: document.querySelector('#catalog'),
  empty: document.querySelector('#empty'),
  search: document.querySelector('#search'),
  kind: document.querySelector('#kind-filter'),
  availability: document.querySelector('#availability-filter'),
  favoritesOnly: document.querySelector('#favorites-only'),
  clear: document.querySelector('#clear-filters'),
  status: document.querySelector('#status'),
  visible: document.querySelector('#visible-count'),
  total: document.querySelector('#total-count'),
  template: document.querySelector('#artifact-card'),
};

let items = [];
let favorites = readFavorites();

function fact(label, value) {
  const wrap = document.createElement('div');
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = label;
  dd.textContent = value || '—';
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
  facts.append(
    fact('ID', item.id),
    fact('Status', item.status),
    fact('Version', item.version),
    fact('Source', item.sourceKind),
    fact('Build', item.buildMode),
    fact('Deployment', item.deployment?.state),
    fact('Git revision', item.git?.revision),
    fact('Changed', item.changedAt),
  );
  return card;
}

function render() {
  const visible = filterArtifacts(items, {
    query: nodes.search.value,
    kind: nodes.kind.value,
    availability: nodes.availability.value,
    favoritesOnly: nodes.favoritesOnly.checked,
    favoriteIds: favorites,
  });
  nodes.catalog.replaceChildren(...visible.map(renderCard));
  nodes.empty.hidden = visible.length !== 0;
  nodes.visible.textContent = String(visible.length);
  nodes.total.textContent = String(items.length);
  nodes.status.textContent = visible.length + ' of ' + items.length + ' artifacts shown.';
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
    render();
  } catch (error) {
    nodes.status.textContent = 'Catalog unavailable: ' + error.message;
    nodes.empty.hidden = false;
    nodes.empty.querySelector('h2').textContent = 'Catalog unavailable';
    nodes.empty.querySelector('p').textContent = 'The V13.5 release catalog could not be loaded.';
  }
}

for (const node of [nodes.search, nodes.kind, nodes.availability, nodes.favoritesOnly]) {
  node.addEventListener(node === nodes.search ? 'input' : 'change', render);
}
nodes.clear.addEventListener('click', () => {
  nodes.search.value = '';
  nodes.kind.value = '';
  nodes.availability.value = '';
  nodes.favoritesOnly.checked = false;
  render();
  nodes.search.focus();
});

load();
