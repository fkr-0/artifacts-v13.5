export const soundThemes = {
  off: {},
  retro: { click: [440, 0.025], success: [880, 0.05], error: [120, 0.08] },
  glass: { click: [660, 0.02], success: [990, 0.04], error: [180, 0.06] },
  terminal: { click: [320, 0.015], success: [640, 0.04], error: [90, 0.05] },
};

export function createSoundEffects({ audioContextFactory } = {}) {
  let enabled = false;
  let theme = 'retro';
  let ctx = null;
  return {
    setEnabled(value) { enabled = Boolean(value); },
    setTheme(value) { theme = soundThemes[value] ? value : 'retro'; },
    play(name = 'click') {
      if (!enabled || theme === 'off') return false;
      const def = soundThemes[theme][name] || soundThemes[theme].click;
      if (!def || typeof audioContextFactory !== 'function') return false;
      ctx ||= audioContextFactory();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = def[0];
      gain.gain.value = 0.025;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + def[1]);
      return true;
    },
  };
}
