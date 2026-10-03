export const initialHubState = Object.freeze({
  lens: 'discover',
  query: '',
  kind: '',
  availability: '',
  evidence: '',
  origin: '',
  capabilitySource: '',
  selectedTags: Object.freeze([]),
  tagMode: 'any',
  sort: 'recent',
  view: 'grid',
  selectedKey: null,
  previewKey: null,
  pendingImport: null,
});

const LENSES = new Set(['discover', 'collection', 'peer']);
const SORTS = new Set(['recent', 'title', 'health', 'evidence']);
const TAG_MODES = new Set(['any', 'all']);
const VIEWS = new Set(['grid', 'list']);

function toggleTag(tags, value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const tag = value.trim();
  const current = Array.isArray(tags) ? tags : [];
  return current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag];
}

function validPendingImport(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof value.sourceName === 'string' &&
      value.sourceName.trim() &&
      Array.isArray(value.items),
  );
}

export function reduceHubState(state, action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) return state;
  switch (action.type) {
    case 'lens':
      return LENSES.has(action.value) ? { ...state, lens: action.value } : state;
    case 'query':
      return typeof action.value === 'string' ? { ...state, query: action.value } : state;
    case 'kind':
      return typeof action.value === 'string' ? { ...state, kind: action.value } : state;
    case 'availability':
      return typeof action.value === 'string' ? { ...state, availability: action.value } : state;
    case 'evidence':
      return typeof action.value === 'string' ? { ...state, evidence: action.value } : state;
    case 'origin':
      return typeof action.value === 'string' ? { ...state, origin: action.value } : state;
    case 'capability-source':
      return typeof action.value === 'string'
        ? { ...state, capabilitySource: action.value }
        : state;
    case 'toggle-tag': {
      const selectedTags = toggleTag(state.selectedTags, action.value);
      return selectedTags ? { ...state, selectedTags } : state;
    }
    case 'clear-tags':
      return state.selectedTags?.length ? { ...state, selectedTags: [] } : state;
    case 'tag-mode':
      return TAG_MODES.has(action.value) ? { ...state, tagMode: action.value } : state;
    case 'sort':
      return SORTS.has(action.value) ? { ...state, sort: action.value } : state;
    case 'view':
      return VIEWS.has(action.value) ? { ...state, view: action.value } : state;
    case 'select':
      return typeof action.value === 'string' || action.value == null
        ? { ...state, selectedKey: action.value || null, previewKey: null }
        : state;
    case 'preview':
      return typeof action.value === 'string' && action.value && action.value === state.selectedKey
        ? { ...state, previewKey: action.value }
        : state;
    case 'stage-import':
      return validPendingImport(action.value) ? { ...state, pendingImport: action.value } : state;
    case 'cancel-import':
      return state.pendingImport ? { ...state, pendingImport: null } : state;
    case 'close-inspector':
      return { ...state, selectedKey: null, previewKey: null };
    case 'reset-filters':
      return {
        ...state,
        query: '',
        kind: '',
        availability: '',
        evidence: '',
        origin: '',
        capabilitySource: '',
        selectedTags: [],
        tagMode: 'any',
        sort: 'recent',
      };
    default:
      return state;
  }
}
