export function createEventLog({ target, limit = 120, runtime = globalThis } = {}) {
  const entries = [];
  const formatTime = (date) => date.toLocaleTimeString?.() || String(date);
  const render = () => {
    if (!target) return;
    target.textContent = entries.map((entry) => `[${formatTime(new Date(entry.at))}] ${entry.level.toUpperCase()} ${entry.message}`).join('\n');
  };
  return {
    entries,
    add(level, ...parts) {
      entries.unshift({ level, message: parts.map((part) => typeof part === 'string' ? part : JSON.stringify(part)).join(' '), at: Date.now() });
      entries.splice(limit);
      render();
      return entries[0];
    },
    info(...parts) { return this.add('info', ...parts); },
    success(...parts) { return this.add('success', ...parts); },
    warn(...parts) { return this.add('warn', ...parts); },
    error(...parts) { return this.add('error', ...parts); },
    clear() { entries.length = 0; render(); },
    render,
  };
}
