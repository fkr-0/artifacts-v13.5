export function textForArtifact(item) {
  return [item.id, item.title, item.kind, item.description, item.note, ...(item.tags || [])]
    .filter(Boolean)
    .join(' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .toLowerCase();
}

export function filterArtifacts(items, query = '') {
  const terms = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [...items];
  return items.filter((item) => {
    const haystack = textForArtifact(item);
    return terms.every((term) => haystack.includes(term));
  });
}

export function collectTagStats(items = []) {
  const counts = new Map();
  for (const item of items) for (const tag of item.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}

export function createTagFilterState(activeTags = [], mode = 'OR') {
  return { activeTags: new Set(activeTags), mode: mode === 'AND' ? 'AND' : 'OR' };
}

export function tagColorStyle(tag = '') {
  // Type-based color mapping for consistent artifact categorization
  const typeColors = {
    // Games - Red
    'game': { hue: 0, class: 'tag-type-game' },
    'shooter': { hue: 0, class: 'tag-type-game' },
    'bomberman': { hue: 0, class: 'tag-type-game' },
    'minesweeper': { hue: 0, class: 'tag-type-game' },
    'solitaire': { hue: 0, class: 'tag-type-game' },
    'brawler': { hue: 0, class: 'tag-type-game' },
    'puzzle': { hue: 0, class: 'tag-type-game' },
    'classic': { hue: 0, class: 'tag-type-game' },
    'cards': { hue: 0, class: 'tag-type-game' },
    'space': { hue: 0, class: 'tag-type-game' },
    'multiplayer': { hue: 0, class: 'tag-type-game' },
    'cyberpunk': { hue: 0, class: 'tag-type-game' },

    // Tools - Green
    'tool': { hue: 142, class: 'tag-type-tool' },
    'generator': { hue: 142, class: 'tag-type-tool' },
    'qr-code': { hue: 142, class: 'tag-type-tool' },
    'utility': { hue: 142, class: 'tag-type-tool' },
    'export': { hue: 142, class: 'tag-type-tool' },
    'palette': { hue: 142, class: 'tag-type-tool' },
    'color': { hue: 142, class: 'tag-type-tool' },
    'theme': { hue: 142, class: 'tag-type-tool' },
    'font': { hue: 142, class: 'tag-type-tool' },
    'sprite': { hue: 142, class: 'tag-type-tool' },
    'extraction': { hue: 142, class: 'tag-type-tool' },
    'graphics': { hue: 280, class: 'tag-type-graphics' },
    'math': { hue: 142, class: 'tag-type-tool' },
    'calculator': { hue: 142, class: 'tag-type-tool' },

    // Editors - Yellow
    'editor': { hue: 45, class: 'tag-type-editor' },
    'notepad': { hue: 45, class: 'tag-type-editor' },
    'text': { hue: 45, class: 'tag-type-editor' },
    'code': { hue: 45, class: 'tag-type-editor' },
    'monaco': { hue: 45, class: 'tag-type-editor' },
    'textarea': { hue: 45, class: 'tag-type-editor' },

    // Audio - Purple
    'audio': { hue: 270, class: 'tag-type-audio' },
    'daw': { hue: 270, class: 'tag-type-audio' },
    'modular': { hue: 270, class: 'tag-type-audio' },
    'music': { hue: 270, class: 'tag-type-audio' },

    // Graphics - Pink
    'graphics': { hue: 300, class: 'tag-type-graphics' },
    'image': { hue: 300, class: 'tag-type-graphics' },
    'visual': { hue: 300, class: 'tag-type-graphics' },

    // Hub - Cyan
    'hub': { hue: 190, class: 'tag-type-hub' },
    'v9': { hue: 190, class: 'tag-type-hub' },
    'v10': { hue: 190, class: 'tag-type-hub' },
    'v11': { hue: 190, class: 'tag-type-hub' },
    'legacy': { hue: 190, class: 'tag-type-hub' },
    'compatibility': { hue: 190, class: 'tag-type-hub' },
    'tooling': { hue: 190, class: 'tag-type-hub' },
    'peernet': { hue: 190, class: 'tag-type-hub' },
    'built': { hue: 190, class: 'tag-type-hub' },

    // Collaborative - Orange
    'collaborative': { hue: 25, class: 'tag-type-collaborative' },
    'p2p': { hue: 25, class: 'tag-type-collaborative' },
    'shared': { hue: 25, class: 'tag-type-collaborative' },

    // Docs - Gray
    'docs': { hue: 210, class: 'tag-type-docs', saturation: 10 },
    'markdown': { hue: 210, class: 'tag-type-docs', saturation: 10 },
    'viewer': { hue: 210, class: 'tag-type-docs', saturation: 10 },
    'catalog': { hue: 210, class: 'tag-type-docs', saturation: 10 },
    'server': { hue: 210, class: 'tag-type-docs', saturation: 10 },
    'roadmap': { hue: 210, class: 'tag-type-docs', saturation: 10 },

    // Writing/Creative - Additional tags
    'ai': { hue: 280, class: 'tag-type-graphics' },
    'prompts': { hue: 280, class: 'tag-type-graphics' },
    'creative': { hue: 280, class: 'tag-type-graphics' },
    'writing': { hue: 280, class: 'tag-type-graphics' },
    'notes': { hue: 45, class: 'tag-type-editor' },
    'console': { hue: 45, class: 'tag-type-editor' },
    'local-first': { hue: 142, class: 'tag-type-tool' },
    'floating': { hue: 190, class: 'tag-type-hub' },
    'themes': { hue: 142, class: 'tag-type-tool' },
    'sound': { hue: 270, class: 'tag-type-audio' },
    'design': { hue: 142, class: 'tag-type-tool' },
  };

  const tagLower = String(tag).toLowerCase();
  const colorConfig = typeColors[tagLower] || typeColors[tagLower.replace(/[^a-z0-9]/g, '')];

  if (colorConfig) {
    const saturation = colorConfig.saturation || 92;
    return `--tag-hue:${colorConfig.hue};--tag-border:hsl(${colorConfig.hue} ${saturation}% 58%);--tag-bg:hsl(${colorConfig.hue} ${saturation}% 18% / .36);--tag-class:${colorConfig.class};`;
  }

  // Fallback to hash-based coloring for unknown tags
  let hash = 0;
  for (const char of String(tag)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return `--tag-hue:${hue};--tag-border:hsl(${hue} 92% 58%);--tag-bg:hsl(${hue} 92% 18% / .36);`;
}

export function toggleTagFilter(state, tag) {
  state.activeTags.has(tag) ? state.activeTags.delete(tag) : state.activeTags.add(tag);
  return state;
}

export function filterArtifactsWithTags(items, state = createTagFilterState()) {
  const tags = [...(state.activeTags || [])];
  if (!tags.length) return [...items];
  return items.filter((item) => {
    const itemTags = new Set(item.tags || []);
    return state.mode === 'AND' ? tags.every((tag) => itemTags.has(tag)) : tags.some((tag) => itemTags.has(tag));
  });
}

export function filterArtifactsAdvanced(items, { query = '', tagState = createTagFilterState() } = {}) {
  return filterArtifacts(filterArtifactsWithTags(items, tagState), query);
}

export function renderTagFilterControls(items, state = createTagFilterState()) {
  return collectTagStats(items).map(({ tag, count }) => {
    const active = state.activeTags?.has(tag) ? ' active' : '';
    const colorStyle = tagColorStyle(tag);
    const tagClassMatch = colorStyle.match(/--tag-class:([^;]+)/);
    const tagClass = tagClassMatch ? tagClassMatch[1] : '';
    return `<button type="button" class="tag-button ${tagClass}${active}" data-tag="${escapeHtml(tag)}" style="${colorStyle}">${escapeHtml(tag)} (${count})</button>`;
  }).join('');
}

export function buildMenuGroups(items, { groupBy = 'tags' } = {}) {
  const groups = new Map();
  for (const item of items) {
    const keys = groupBy === 'kind' ? [item.kind || 'other'] : (item.tags?.length ? item.tags : [item.kind || 'other']);
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, { id: key, title: titleize(key), items: [] });
      groups.get(key).items.push(item);
    }
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function titleize(value) {
  return String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[char]);
}
