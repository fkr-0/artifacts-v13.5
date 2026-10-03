const SAFE_WEB_PROTOCOLS = new Set(['http:', 'https:']);
const POLICY_EFFECTS = new Set(['allow', 'confirm', 'deny']);
const POLICY_ACTIONS = new Set(['launch', 'preview']);
const POLICY_TARGET_KINDS = new Set(['none', 'blocked', 'local', 'remote']);
const POLICY_CONDITION_KEYS = new Set(['targetKind', 'kind', 'availability', 'tag']);

export class PolicyContractError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PolicyContractError';
    this.details = details;
  }
}

function validatePolicyRules(rules) {
  if (!Array.isArray(rules)) throw new PolicyContractError('Policy rules must be an array');
  const ids = new Set();
  return rules.map((rule, index) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      throw new PolicyContractError('Policy rule must be an object', { index });
    }
    const id = typeof rule.id === 'string' ? rule.id.trim() : '';
    if (!id) throw new PolicyContractError('Policy rule requires an id', { index });
    if (ids.has(id)) throw new PolicyContractError(`Duplicate policy rule id: ${id}`, { index });
    ids.add(id);
    if (!POLICY_ACTIONS.has(rule.action)) {
      throw new PolicyContractError(`Unknown policy action: ${rule.action}`, { index });
    }
    if (!POLICY_EFFECTS.has(rule.effect)) {
      throw new PolicyContractError(`Unknown policy effect: ${rule.effect}`, { index });
    }
    if (rule.when != null && (typeof rule.when !== 'object' || Array.isArray(rule.when))) {
      throw new PolicyContractError('Policy rule when must be an object', { index });
    }
    const when = rule.when || {};
    for (const key of Object.keys(when)) {
      if (!POLICY_CONDITION_KEYS.has(key)) {
        throw new PolicyContractError(`Unknown policy condition: ${key}`, { index });
      }
      if (typeof when[key] !== 'string' || !when[key].trim()) {
        throw new PolicyContractError(`Policy condition ${key} must be a non-empty string`, {
          index,
        });
      }
    }
    if (when.targetKind && !POLICY_TARGET_KINDS.has(when.targetKind)) {
      throw new PolicyContractError(`Unknown target kind: ${when.targetKind}`, { index });
    }
    return { ...rule, id, when };
  });
}

function ruleMatches(rule, item, target) {
  const when = rule.when || {};
  if (when.targetKind && when.targetKind !== target.kind) return false;
  if (when.kind && when.kind !== item?.kind) return false;
  if (when.availability && when.availability !== item?.availability) return false;
  if (when.tag && !(item?.tags || []).includes(when.tag)) return false;
  return true;
}

export function resolvePolicyEffects(effects) {
  if (!Array.isArray(effects)) throw new PolicyContractError('Policy effects must be an array');
  for (const effect of effects) {
    if (!POLICY_EFFECTS.has(effect))
      throw new PolicyContractError(`Unknown policy effect: ${effect}`);
  }
  const unique = [...new Set(effects)];
  return Object.freeze({
    effect: unique.includes('deny')
      ? 'deny'
      : unique.includes('confirm')
        ? 'confirm'
        : unique.includes('allow')
          ? 'allow'
          : null,
    conflict: unique.length > 1,
    effects: Object.freeze(unique),
  });
}

function restrictDecision(baseDecision, effect) {
  if (!effect || effect === 'allow') return baseDecision;
  if (effect === 'deny') return 'blocked';
  if (baseDecision === 'blocked') return baseDecision;
  return 'confirm';
}

export function evaluatePolicyRules(item, rules = [], options = {}) {
  const validatedRules = validatePolicyRules(rules);
  const base = interactionPolicy(item, options);
  const decisions = {};

  for (const action of POLICY_ACTIONS) {
    const matched = [];
    for (const rule of validatedRules) {
      if (rule.action === action && ruleMatches(rule, item, base.target)) matched.push(rule);
    }
    const resolved = resolvePolicyEffects(matched.map((rule) => rule.effect));
    decisions[action] = Object.freeze({
      decision: restrictDecision(base[action], resolved.effect),
      conflict: resolved.conflict,
      matchedRuleIds: Object.freeze(matched.map((rule) => rule.id)),
      resolvedEffect: resolved.effect,
    });
  }

  return Object.freeze({ target: base.target, base, ...decisions });
}

export function classifyTarget(rawUrl, { baseOrigin = 'https://v13hub.invalid' } = {}) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return Object.freeze({
      kind: 'none',
      allowed: false,
      url: null,
      reason: 'No launch target is recorded.',
    });
  }

  const input = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(input, `${baseOrigin.replace(/\/$/, '')}/`);
  } catch {
    return Object.freeze({
      kind: 'blocked',
      allowed: false,
      url: null,
      reason: 'The recorded target is not a valid URL.',
    });
  }

  if (!SAFE_WEB_PROTOCOLS.has(parsed.protocol)) {
    return Object.freeze({
      kind: 'blocked',
      allowed: false,
      url: null,
      reason: `Blocked URL scheme: ${parsed.protocol}`,
    });
  }
  if (parsed.username || parsed.password) {
    return Object.freeze({
      kind: 'blocked',
      allowed: false,
      url: null,
      reason: 'Credential-bearing URLs are blocked.',
    });
  }

  const base = new URL(`${baseOrigin.replace(/\/$/, '')}/`);
  const isRemote = parsed.origin !== base.origin;
  return Object.freeze({
    kind: isRemote ? 'remote' : 'local',
    allowed: true,
    url: parsed.href,
    reason: isRemote ? 'Remote target requires an explicit user action.' : 'Same-origin target.',
  });
}

export function interactionPolicy(item, options = {}) {
  const target = classifyTarget(item?.url, options);
  if (target.kind === 'none' || target.kind === 'blocked') {
    return Object.freeze({
      target,
      preview: 'blocked',
      launch: 'blocked',
      reason: target.reason,
    });
  }
  if (target.kind === 'remote') {
    return Object.freeze({
      target,
      preview: 'blocked',
      launch: 'confirm-remote',
      reason: 'V13Hub never fetches or embeds remote artifact content automatically.',
    });
  }
  return Object.freeze({
    target,
    preview: 'user-requested-strict-sandbox',
    launch: 'user-requested-local',
    reason: 'Local previews load only after an explicit click and receive no sandbox capabilities.',
  });
}

export function networkProofState(adapter) {
  if (!adapter) {
    return Object.freeze({
      state: 'disabled',
      connected: false,
      peerCount: 0,
      proof: null,
      label: 'Peer layer off',
    });
  }
  let health;
  try {
    health = typeof adapter.health === 'function' ? adapter.health() : adapter.health;
  } catch {
    return Object.freeze({
      state: 'unknown',
      connected: false,
      peerCount: 0,
      proof: null,
      label: 'No peer proof',
    });
  }
  if (!health || typeof health !== 'object') {
    return Object.freeze({
      state: 'unknown',
      connected: false,
      peerCount: 0,
      proof: null,
      label: 'No peer proof',
    });
  }
  const connected = health.connected === true;
  return Object.freeze({
    state: String(health.state || (connected ? 'connected' : 'offline')),
    connected,
    peerCount: Number.isFinite(health.peerCount) ? health.peerCount : 0,
    proof: connected ? health : null,
    label: connected
      ? `${Number.isFinite(health.peerCount) ? health.peerCount : 0} peers`
      : 'No peer proof',
  });
}
