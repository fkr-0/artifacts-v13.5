export const LEGACY_TOOLS = [
  {
    id: 'v9-notepad',
    title: 'v9 Quick Notepad',
    desc: 'Simple localStorage notepad ported from the v9 embedded app deck.',
    kind: 'notepad',
    lineage: 'v9',
    storageKey: 'v11:legacy:v9-notepad',
  },
  {
    id: 'v10-notepad',
    title: 'v10 Local-first Notepad',
    desc: 'The v10 enhanced portal notepad concept as a v11 standalone tool.',
    kind: 'notepad',
    lineage: 'v10',
    storageKey: 'v11:legacy:v10-notepad',
  },
  {
    id: 'v10-shared-pad',
    title: 'v10 Shared Text Pad',
    desc: 'Lightweight shared text pad surface with BroadcastChannel sync for same-browser sessions.',
    kind: 'shared-pad',
    lineage: 'v10',
    storageKey: 'v11:legacy:v10-shared-pad',
    sync: 'broadcast-channel',
  },
  {
    id: 'v9-calculator',
    title: 'v9 Sci-Fi Calculator',
    desc: 'Cyberpunk calculator with history tape, ported from the v9 embedded utility.',
    kind: 'calculator',
    lineage: 'v9',
    storageKey: 'v11:legacy:v9-calculator-history',
  },
  {
    id: 'v4-console-notes',
    title: 'v4 Console Notes',
    desc: 'Small operator notes panel for the v4 console runtime lineage.',
    kind: 'notepad',
    lineage: 'v4',
    storageKey: 'v11:legacy:v4-console-notes',
  },

  {
    id: 'v8-native-scratchpad',
    title: 'v8 Native Scratchpad',
    desc: 'Native lightweight scratchpad inspired by the v8 editor flow, with hub-scoped local autosave.',
    kind: 'notepad',
    lineage: 'v8',
    storageKey: 'v11:legacy:v8-native-scratchpad',
  },
  {
    id: 'v8-collab-code-editor',
    title: 'v8 Collab Code Editor',
    desc: 'Full Monaco collaborative editor from the earlier app hub line, launched from the v11 utility host.',
    kind: 'external-editor',
    lineage: 'v8',
    storageKey: 'v11:legacy:v8-collab-code-editor',
    href: '../app-hub/collab-editor.html',
  },
  {
    id: 'v8-collab-pad-lite',
    title: 'v8 Collab Pad Lite',
    desc: 'Textarea collaborative editor from the earlier app hub line, launched from the v11 utility host.',
    kind: 'external-editor',
    lineage: 'v8',
    storageKey: 'v11:legacy:v8-collab-pad-lite',
    href: '../app-hub/collab-editor-lite.html',
  },
];

export const LEGACY_TEXT_TOOL_IDS = LEGACY_TOOLS
  .filter((tool) => ['notepad', 'shared-pad', 'external-editor'].includes(tool.kind))
  .map((tool) => tool.id);

export function legacyToolById(id) {
  const tool = LEGACY_TOOLS.find((candidate) => candidate.id === id);
  if (!tool) throw new Error(`Unknown legacy tool: ${id}`);
  return tool;
}

function safeNumber(value) {
  return Number.isFinite(value) ? Number(value.toPrecision(12)) : 'ERR';
}

function evaluateExpression(expression) {
  if (!/^[0-9+\-*/().\s]+$/.test(expression)) return 'ERR';
  try {
    return safeNumber(Function('"use strict"; return (' + expression + ')')());
  } catch {
    return 'ERR';
  }
}

function formatExpression(expression) {
  return expression.replace(/\s*([+\-*/])\s*/g, ' $1 ').replace(/\s+/g, ' ').trim();
}

export function createCalculatorMachine(initial = {}) {
  const state = {
    display: initial.display || '0',
    history: Array.isArray(initial.history) ? [...initial.history] : [],
  };

  return {
    get display() {
      return state.display;
    },
    get history() {
      return [...state.history];
    },
    clearHistory() {
      state.history = [];
    },
    press(key) {
      if (key === 'C') {
        state.display = '0';
      } else if (key === '⌫') {
        state.display = state.display.length > 1 ? state.display.slice(0, -1) : '0';
      } else if (key === '=') {
        const expression = state.display.trim();
        const result = evaluateExpression(expression);
        state.history.push(`${formatExpression(expression)} = ${result}`);
        state.history = state.history.slice(-50);
        state.display = String(result);
      } else if (/^[0-9+\-*/().]$/.test(key)) {
        state.display = state.display === '0' || state.display === 'ERR' ? key : state.display + key;
      }
      return state.display;
    },
  };
}
