export const themes = [
  {
    id: 'nexus',
    title: 'NEXUS',
    mood: 'cyan glass command deck',
    tokens: {
      accent: '#00ffff', secondary: '#ff3df5', tertiary: '#00ff88',
      background: '#040714', surface: 'rgba(4,18,34,.82)', panel: 'rgba(0,8,18,.68)',
      text: '#e8fbff', muted: 'rgba(232,251,255,.68)', glow: 'rgba(0,255,255,.32)',
      grid: 'rgba(0,255,255,.105)', scanline: 'rgba(255,255,255,.05)', noise: '.28', radius: '8px', border: 'rgba(0,255,255,.34)',
      bodyBg: 'radial-gradient(circle at 12% 8%, rgba(0,255,255,.30), transparent 24rem), radial-gradient(circle at 88% 18%, rgba(255,61,245,.18), transparent 22rem), linear-gradient(135deg, #040714 0%, #071427 58%, #030611 100%)',
      panelBg: 'linear-gradient(145deg, rgba(5,24,44,.88), rgba(0,7,16,.72))',
      cardBg: 'linear-gradient(145deg, rgba(7,28,48,.82), rgba(2,8,18,.76))',
      footerBg: 'linear-gradient(90deg, rgba(0,8,18,.95), rgba(4,24,42,.92), rgba(0,8,18,.95))',
      shadow: '0 0 28px rgba(0,255,255,.14), 5px 5px 0 rgba(0,255,255,.10)',
      font: '"Share Tech Mono", monospace', titleSpacing: '.15em', pixelate: 'pixelated', filter: 'saturate(1.12) contrast(1.06)'
    }
  },
  {
    id: 'default',
    title: 'TRON',
    mood: 'hardline cyan grid arena',
    tokens: {
      accent: '#00eaff', secondary: '#006eff', tertiary: '#ffffff',
      background: '#02040a', surface: 'rgba(0,20,34,.86)', panel: 'rgba(0,2,8,.76)',
      text: '#eaffff', muted: 'rgba(234,255,255,.66)', glow: 'rgba(0,234,255,.38)',
      grid: 'rgba(0,234,255,.18)', scanline: 'rgba(0,234,255,.045)', noise: '.12', radius: '0px', border: 'rgba(0,234,255,.48)',
      bodyBg: 'radial-gradient(circle at 50% -18%, rgba(0,234,255,.26), transparent 30rem), linear-gradient(180deg, #02040a 0%, #00111e 60%, #02040a 100%)',
      panelBg: 'linear-gradient(180deg, rgba(0,23,40,.92), rgba(0,4,12,.88))',
      cardBg: 'linear-gradient(180deg, rgba(0,30,50,.84), rgba(0,6,14,.80))',
      footerBg: 'linear-gradient(90deg, #000812, #002439, #000812)',
      shadow: '0 0 0 1px rgba(0,234,255,.18), 0 0 28px rgba(0,234,255,.18)',
      font: '"Orbitron", "Share Tech Mono", monospace', titleSpacing: '.22em', pixelate: 'crisp-edges', filter: 'contrast(1.18) saturate(1.25)'
    }
  },
  {
    id: 'synthwave',
    title: 'Synthwave',
    mood: 'magenta sunset arcade haze',
    tokens: {
      accent: '#ff43d7', secondary: '#35e6ff', tertiary: '#ffd166',
      background: '#170320', surface: 'rgba(55,8,76,.84)', panel: 'rgba(24,0,34,.74)',
      text: '#fff0fb', muted: 'rgba(255,232,250,.70)', glow: 'rgba(255,67,215,.42)',
      grid: 'rgba(255,67,215,.12)', scanline: 'rgba(53,230,255,.04)', noise: '.20', radius: '14px', border: 'rgba(255,67,215,.42)',
      bodyBg: 'radial-gradient(circle at 18% 15%, rgba(255,67,215,.40), transparent 23rem), radial-gradient(circle at 80% 8%, rgba(53,230,255,.24), transparent 18rem), linear-gradient(180deg, #240330 0%, #170320 46%, #2b0c3f 100%)',
      panelBg: 'linear-gradient(145deg, rgba(65,8,88,.88), rgba(20,0,32,.78))',
      cardBg: 'linear-gradient(145deg, rgba(82,12,102,.82), rgba(24,2,38,.78))',
      footerBg: 'linear-gradient(90deg, rgba(28,0,38,.96), rgba(92,10,102,.88), rgba(8,18,45,.92))',
      shadow: '0 0 34px rgba(255,67,215,.22), 7px 7px 0 rgba(53,230,255,.10)',
      font: '"Share Tech Mono", monospace', titleSpacing: '.12em', pixelate: 'auto', filter: 'saturate(1.45) hue-rotate(-8deg)'
    }
  },
  {
    id: 'cyberpunk',
    title: 'Cyberpunk',
    mood: 'yellow hazard street terminal',
    tokens: {
      accent: '#ffee00', secondary: '#ff305c', tertiary: '#00f5ff',
      background: '#120d00', surface: 'rgba(45,34,0,.88)', panel: 'rgba(10,8,0,.78)',
      text: '#fffbd0', muted: 'rgba(255,251,208,.68)', glow: 'rgba(255,238,0,.36)',
      grid: 'rgba(255,238,0,.11)', scanline: 'rgba(255,48,92,.055)', noise: '.36', radius: '2px', border: 'rgba(255,238,0,.52)',
      bodyBg: 'radial-gradient(circle at 80% 16%, rgba(255,48,92,.28), transparent 18rem), radial-gradient(circle at 18% 80%, rgba(255,238,0,.22), transparent 24rem), linear-gradient(135deg, #120d00 0%, #241600 55%, #070605 100%)',
      panelBg: 'repeating-linear-gradient(135deg, rgba(255,238,0,.06) 0 2px, transparent 2px 10px), linear-gradient(145deg, rgba(50,34,0,.88), rgba(8,7,0,.82))',
      cardBg: 'linear-gradient(145deg, rgba(62,45,0,.86), rgba(12,10,0,.82))',
      footerBg: 'linear-gradient(90deg, #100b00, #3d2c00, #100b00)',
      shadow: '0 0 28px rgba(255,238,0,.16), 6px 6px 0 rgba(255,48,92,.16)',
      font: '"Share Tech Mono", monospace', titleSpacing: '.09em', pixelate: 'pixelated', filter: 'contrast(1.22) saturate(1.34)'
    }
  },
  {
    id: 'retro8bit',
    title: 'Retro 8-Bit',
    mood: 'phosphor pixel cartridge',
    tokens: {
      accent: '#7cff00', secondary: '#ffef5a', tertiary: '#00ffa8',
      background: '#050905', surface: 'rgba(10,28,8,.88)', panel: 'rgba(0,8,0,.78)',
      text: '#efffe8', muted: 'rgba(239,255,232,.66)', glow: 'rgba(124,255,0,.30)',
      grid: 'rgba(124,255,0,.16)', scanline: 'rgba(124,255,0,.075)', noise: '.42', radius: '0px', border: 'rgba(124,255,0,.50)',
      bodyBg: 'linear-gradient(180deg, #050905 0%, #071505 52%, #020402 100%)',
      panelBg: 'repeating-linear-gradient(0deg, rgba(124,255,0,.07) 0 1px, transparent 1px 5px), linear-gradient(145deg, rgba(10,32,8,.90), rgba(0,8,0,.84))',
      cardBg: 'linear-gradient(145deg, rgba(14,38,10,.88), rgba(2,12,2,.82))',
      footerBg: 'linear-gradient(90deg, #020602, #0d2408, #020602)',
      shadow: '4px 4px 0 rgba(124,255,0,.18), 0 0 18px rgba(124,255,0,.12)',
      font: '"Share Tech Mono", monospace', titleSpacing: '.05em', pixelate: 'pixelated', filter: 'contrast(1.35) saturate(1.1)'
    }
  },
  {
    id: 'midnight',
    title: 'Midnight',
    mood: 'deep blue stealth cockpit',
    tokens: {
      accent: '#8bbcff', secondary: '#6d7dff', tertiary: '#b8e0ff',
      background: '#030713', surface: 'rgba(8,16,42,.82)', panel: 'rgba(2,6,18,.76)',
      text: '#eef5ff', muted: 'rgba(238,245,255,.70)', glow: 'rgba(139,188,255,.30)',
      grid: 'rgba(139,188,255,.08)', scanline: 'rgba(184,224,255,.035)', noise: '.14', radius: '10px', border: 'rgba(139,188,255,.30)',
      bodyBg: 'radial-gradient(circle at 70% 12%, rgba(109,125,255,.28), transparent 24rem), linear-gradient(180deg, #030713, #07162f 58%, #02040b)',
      panelBg: 'linear-gradient(145deg, rgba(9,18,48,.88), rgba(2,6,18,.82))',
      cardBg: 'linear-gradient(145deg, rgba(12,22,56,.80), rgba(3,8,22,.80))',
      footerBg: 'linear-gradient(90deg, #020612, #0a1c3d, #020612)',
      shadow: '0 0 36px rgba(139,188,255,.12), 0 12px 36px rgba(0,0,0,.38)',
      font: '"Share Tech Mono", monospace', titleSpacing: '.18em', pixelate: 'auto', filter: 'brightness(.95) saturate(1.15)'
    }
  },
  {
    id: 'vaporwave',
    title: 'Vaporwave',
    mood: 'violet glass mall sunset',
    tokens: {
      accent: '#80f7ff', secondary: '#ff8bf3', tertiary: '#ffe6a7',
      background: '#1b0730', surface: 'rgba(52,18,78,.78)', panel: 'rgba(20,4,36,.68)',
      text: '#f8ecff', muted: 'rgba(248,236,255,.70)', glow: 'rgba(128,247,255,.30)',
      grid: 'rgba(255,139,243,.10)', scanline: 'rgba(128,247,255,.04)', noise: '.18', radius: '18px', border: 'rgba(128,247,255,.34)',
      bodyBg: 'radial-gradient(circle at 20% 12%, rgba(255,139,243,.32), transparent 22rem), radial-gradient(circle at 84% 18%, rgba(128,247,255,.26), transparent 22rem), linear-gradient(180deg, #25083d 0%, #1b0730 44%, #351257 100%)',
      panelBg: 'linear-gradient(145deg, rgba(61,20,92,.78), rgba(18,4,34,.72))',
      cardBg: 'linear-gradient(145deg, rgba(75,24,108,.76), rgba(24,6,42,.72))',
      footerBg: 'linear-gradient(90deg, #160426, #3b145b, #073045)',
      shadow: '0 0 30px rgba(128,247,255,.16), 0 0 42px rgba(255,139,243,.10)',
      font: '"Share Tech Mono", monospace', titleSpacing: '.14em', pixelate: 'auto', filter: 'saturate(1.35) brightness(1.05)'
    }
  },
  {
    id: 'neon-rust',
    title: 'Neon Rust',
    mood: 'orange industrial heat sink',
    tokens: {
      accent: '#ff7a3d', secondary: '#19ffd2', tertiary: '#ffd36a',
      background: '#150705', surface: 'rgba(48,16,8,.86)', panel: 'rgba(12,5,3,.78)',
      text: '#fff1eb', muted: 'rgba(255,241,235,.68)', glow: 'rgba(255,122,61,.34)',
      grid: 'rgba(255,122,61,.11)', scanline: 'rgba(25,255,210,.035)', noise: '.32', radius: '4px', border: 'rgba(255,122,61,.44)',
      bodyBg: 'radial-gradient(circle at 16% 20%, rgba(255,122,61,.30), transparent 22rem), radial-gradient(circle at 84% 70%, rgba(25,255,210,.14), transparent 18rem), linear-gradient(135deg, #150705, #2c0f08 58%, #070302)',
      panelBg: 'repeating-linear-gradient(90deg, rgba(255,122,61,.045) 0 1px, transparent 1px 12px), linear-gradient(145deg, rgba(55,18,9,.88), rgba(12,5,3,.82))',
      cardBg: 'linear-gradient(145deg, rgba(66,21,10,.84), rgba(14,6,4,.82))',
      footerBg: 'linear-gradient(90deg, #100503, #40170a, #03231d)',
      shadow: '0 0 30px rgba(255,122,61,.16), 6px 6px 0 rgba(25,255,210,.10)',
      font: '"Share Tech Mono", monospace', titleSpacing: '.11em', pixelate: 'pixelated', filter: 'contrast(1.16) saturate(1.25)'
    }
  },
  {
    id: 'matrix',
    title: 'Matrix',
    mood: 'green rain black operator',
    tokens: {
      accent: '#00ff88', secondary: '#baff00', tertiary: '#00ffaa',
      background: '#000503', surface: 'rgba(2,28,14,.86)', panel: 'rgba(0,8,4,.82)',
      text: '#e9fff4', muted: 'rgba(233,255,244,.64)', glow: 'rgba(0,255,136,.34)',
      grid: 'rgba(0,255,136,.13)', scanline: 'rgba(186,255,0,.06)', noise: '.24', radius: '1px', border: 'rgba(0,255,136,.46)',
      bodyBg: 'radial-gradient(circle at 50% 0%, rgba(0,255,136,.18), transparent 28rem), linear-gradient(180deg, #000503, #00140a 56%, #000201)',
      panelBg: 'repeating-linear-gradient(90deg, rgba(0,255,136,.055) 0 1px, transparent 1px 9px), linear-gradient(145deg, rgba(2,34,16,.90), rgba(0,8,4,.86))',
      cardBg: 'linear-gradient(145deg, rgba(3,38,18,.86), rgba(0,10,5,.84))',
      footerBg: 'linear-gradient(90deg, #000402, #002412, #000402)',
      shadow: '0 0 24px rgba(0,255,136,.18), 0 0 2px rgba(186,255,0,.30)',
      font: '"Share Tech Mono", monospace', titleSpacing: '.10em', pixelate: 'pixelated', filter: 'contrast(1.26) saturate(1.18)'
    }
  },
];

export function themeById(id) {
  return themes.find((theme) => theme.id === id) || themes[0];
}

export function cssVarsForTheme(theme) {
  const tokens = theme.tokens || {};
  return {
    '--hub-accent': tokens.accent || theme.accent || '#00ffff',
    '--hub-secondary': tokens.secondary || '#ff00ff',
    '--hub-tertiary': tokens.tertiary || '#00ff88',
    '--hub-background': tokens.background || theme.background || '#060713',
    '--hub-surface': tokens.surface || 'rgba(5,16,28,.74)',
    '--hub-panel': tokens.panel || 'rgba(0,0,0,.34)',
    '--hub-text': tokens.text || '#e8fbff',
    '--hub-muted': tokens.muted || 'rgba(232,251,255,.68)',
    '--hub-glow': tokens.glow || 'rgba(0,255,255,.22)',
    '--hub-grid': tokens.grid || 'rgba(0,255,255,.10)',
    '--hub-scanline': tokens.scanline || 'rgba(255,255,255,.05)',
    '--hub-noise-opacity': tokens.noise || '.25',
    '--hub-radius': tokens.radius || '8px',
    '--hub-border': tokens.border || 'rgba(0,255,255,.28)',
    '--hub-body-bg': tokens.bodyBg || tokens.background || '#060713',
    '--hub-panel-bg': tokens.panelBg || tokens.panel || 'rgba(0,0,0,.34)',
    '--hub-card-bg': tokens.cardBg || tokens.surface || 'rgba(5,16,28,.74)',
    '--hub-footer-bg': tokens.footerBg || tokens.panelBg || tokens.panel || 'rgba(0,0,0,.34)',
    '--hub-shadow': tokens.shadow || '0 4px 12px rgba(0,0,0,.4), 0 0 20px rgba(0,255,255,.08)',
    '--hub-font': tokens.font || '"Share Tech Mono", monospace',
    '--hub-title-spacing': tokens.titleSpacing || '.15em',
    '--hub-image-rendering': tokens.pixelate || 'pixelated',
    '--hub-filter': tokens.filter || 'none',
  };
}

export function applyThemeTokens(id, root = globalThis.document?.documentElement) {
  const theme = themeById(id);
  const vars = cssVarsForTheme(theme);
  for (const [key, value] of Object.entries(vars)) root?.style?.setProperty(key, value);
  root?.setAttribute?.('data-theme', theme.id);
  root?.setAttribute?.('data-theme-mood', theme.mood || theme.title);
  return theme;
}

export const applyTheme = applyThemeTokens;

export function buildThemeStyleText(themeList = themes) {
  return themeList.map((theme) => {
    const vars = cssVarsForTheme(theme);
    const declarations = Object.entries(vars).map(([key, value]) => `  ${key}: ${value};`).join('\n');
    return `[data-theme="${theme.id}"] {\n${declarations}\n}`;
  }).join('\n\n');
}
