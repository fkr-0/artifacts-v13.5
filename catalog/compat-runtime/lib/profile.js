export function normalizeProfile(input = {}) {
  const fallbackNumber = Math.floor(Math.random() * 9000 + 1000);
  const displayName = String(input.displayName || input.username || input.name || `Pilot-${fallbackNumber}`).trim();
  const handle = String(input.handle || `@${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pilot'}`).trim();
  return {
    displayName,
    handle: handle.startsWith('@') ? handle : `@${handle}`,
    role: String(input.role || 'artifact pilot').trim(),
    color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#00ffff',
    status: String(input.status || 'online').trim(),
    note: String(input.note || '').trim(),
    sharedLayer: input.sharedLayer !== false,
    allowIncomingSaveStates: input.allowIncomingSaveStates !== false,
  };
}

export function avatarInitials(profile = {}) {
  const normalized = normalizeProfile(profile);
  const parts = normalized.displayName.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : normalized.displayName.slice(0, 2)).toUpperCase();
}

export function profileSummary(profile = {}) {
  const normalized = normalizeProfile(profile);
  return `${normalized.displayName} ${normalized.handle} · ${normalized.role}`;
}
