import { capabilityProfileFor } from './catalog.js';

export const PEER_OFFER_PROTOCOL = 'v13hub.peer-offer/v1';
export const PEER_SESSION_PROTOCOL = 'v13hub.peer-session/v1';
export const PEER_GAME_HANDOFF_PROTOCOL = 'v13hub.game-handoff/v1';
export const PEER_INVITATION_PREFIX = 'v13hub-peer-v1.';
export const PEER_CAPABILITIES = Object.freeze({
  PRESENCE: 'presence-v1',
  NEGOTIATION: 'capability-negotiation-v1',
  ARTIFACT_OFFER: 'artifact-offer-v1',
  STATE_SYNC: 'artifact-state-sync-v1',
  GAME_LOBBY: 'game-lobby-v1',
  LOBBY_CHAT: 'lobby-chat-v1',
});
export const DEFAULT_PEER_POLICY = Object.freeze({
  maxPeers: 8,
  maxMessageBytes: 48 * 1024,
  maxQueuedOutbound: 32,
  maxBufferedBytes: 128 * 1024,
  replayWindow: 64,
  ackTimeoutMs: 5_000,
  handshakeTimeoutMs: 5_000,
  heartbeatIntervalMs: 10_000,
  staleAfterMs: 30_000,
  reconnectBaseDelayMs: 250,
  reconnectMaxDelayMs: 4_000,
  reconnectMaxAttempts: 6,
  reconnectJitterRatio: 0.2,
  maxOfferBytes: 256 * 1024 * 1024,
  offerTtlMs: 2 * 60_000,
  maxPresence: 8,
  maxPendingOffers: 32,
  maxChatMessages: 64,
  maxChatChars: 600,
  maxGameSessions: 32,
  maxGamePlayers: 8,
  gameSessionTtlMs: 60 * 60_000,
});
const SESSION_NAMESPACE = 'v13hub-peer-session';
const TOPICS = Object.freeze({
  PRESENCE: 'v13hub/presence',
  CAPABILITIES: 'v13hub/capabilities',
  OFFER: 'v13hub/artifact-offer',
  LATENCY_PING: 'v13hub/latency-ping',
  LATENCY_PONG: 'v13hub/latency-pong',
  STATE: 'v13hub/state',
  CHAT: 'v13hub/lobby-chat',
  GAME_SESSION: 'v13hub/game-session',
  GAME_JOIN: 'v13hub/game-join',
  GAME_LEAVE: 'v13hub/game-leave',
  GAME_HANDOFF: 'v13hub/game-handoff',
});
const MODULE_CANDIDATES = Object.freeze([
  Object.freeze({ peernet: '../peernetjs/src/index.js', peerjslib: '../peerjslib/dist/index.js' }),
  Object.freeze({
    peernet: '../../peernetjs/src/index.js',
    peerjslib: '../../peerjslib/dist/index.js',
  }),
]);

export class PeerContractError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PeerContractError';
    this.details = details;
  }
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function safeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function readHealth(adapter) {
  if (typeof adapter?.getHealth === 'function') return adapter.getHealth();
  if (typeof adapter?.health === 'function') return adapter.health();
  return adapter?.health;
}
function peerCountFromHealth(health) {
  const direct = safeNonNegativeInteger(health?.peerCount);
  if (direct != null) return direct;
  const nested = safeNonNegativeInteger(health?.transport?.connectedPeers);
  return nested ?? 0;
}
const EMPTY_TELEMETRY = Object.freeze({
  role: null,
  epoch: null,
  queuedOutbound: null,
  pendingOutbound: null,
  reconnectAttempts: null,
  backpressureSignals: null,
  lastError: null,
});
function telemetryFromHealth(health) {
  const transport =
    health?.transport && typeof health.transport === 'object' && !Array.isArray(health.transport)
      ? health.transport
      : {};
  const optionalInteger = (key) => {
    const direct = safeNonNegativeInteger(health?.[key]);
    if (direct != null) return direct;
    return safeNonNegativeInteger(transport?.[key]);
  };
  return Object.freeze({
    role: cleanString(health?.role) || cleanString(transport?.role) || null,
    epoch: cleanString(health?.epoch) || cleanString(transport?.epoch) || null,
    queuedOutbound: optionalInteger('queuedOutbound'),
    pendingOutbound: optionalInteger('pendingOutbound'),
    reconnectAttempts: optionalInteger('reconnectAttempts'),
    backpressureSignals: optionalInteger('backpressureSignals'),
    lastError: cleanString(health?.lastError) || cleanString(transport?.lastError) || null,
  });
}

export function normalizePeerRuntime(adapter) {
  if (!adapter) {
    return Object.freeze({
      state: 'disabled',
      connected: false,
      handoffReady: false,
      peerCount: 0,
      proof: null,
      telemetry: EMPTY_TELEMETRY,
      label: 'Peer layer off',
      reason: 'No peer adapter is installed in this build.',
    });
  }
  let health;
  try {
    health = readHealth(adapter);
  } catch (error) {
    return Object.freeze({
      state: 'unknown',
      connected: false,
      handoffReady: false,
      peerCount: 0,
      proof: null,
      telemetry: Object.freeze({ ...EMPTY_TELEMETRY, lastError: String(error?.message || error) }),
      label: 'No peer proof',
      reason: `Peer health read failed: ${String(error?.message || error)}`,
    });
  }
  if (!health || typeof health !== 'object' || Array.isArray(health)) {
    return Object.freeze({
      state: 'unknown',
      connected: false,
      handoffReady: false,
      peerCount: 0,
      proof: null,
      telemetry: EMPTY_TELEMETRY,
      label: 'No peer proof',
      reason: 'The peer adapter did not provide a health object.',
    });
  }
  const connected = health.connected === true;
  const handoffReady = connected && health.handoffReady !== false;
  const state = cleanString(health.state) || (connected ? 'online' : 'offline');
  const peerCount = connected ? peerCountFromHealth(health) : 0;
  const proof = connected ? Object.freeze({ state, connected: true, peerCount }) : null;
  const telemetry = telemetryFromHealth(health);
  const degradedReason = cleanString(health.degradedReason);
  return Object.freeze({
    state,
    connected,
    handoffReady,
    peerCount,
    proof,
    telemetry,
    label: connected ? `${peerCount} peer${peerCount === 1 ? '' : 's'}` : 'No peer proof',
    reason: connected
      ? handoffReady
        ? 'Peer count comes from the current adapter health snapshot only.'
        : degradedReason ||
          'Transport is connected but artifact handoff is fail-closed while degraded.'
      : 'The adapter has not supplied explicit connected health evidence.',
  });
}

function sha256From(item) {
  const candidates = [
    cleanString(item?.contentHash),
    cleanString(item?.sha256) ? `sha256:${cleanString(item.sha256)}` : '',
    cleanString(item?.integrity?.sha256) ? `sha256:${cleanString(item.integrity.sha256)}` : '',
    cleanString(item?.receipt?.sha256) ? `sha256:${cleanString(item.receipt.sha256)}` : '',
  ].filter(Boolean);
  return candidates.find((value) => /^sha256:[a-f0-9]{64}$/i.test(value)) || null;
}
function declaredSizeFrom(item) {
  for (const value of [item?.sizeBytes, item?.bytes, item?.contentSize]) {
    if (Number.isSafeInteger(value) && value > 0) return value;
  }
  return null;
}

export function peerCollectionReadiness(item, runtime = normalizePeerRuntime(null)) {
  const capability = item?.capabilityProfile || capabilityProfileFor(item || {});
  const signals = [...capability.peerSignals];
  const contentHash = sha256From(item);
  const sizeBytes = declaredSizeFrom(item);
  const capabilityDetail = capability.declaredPeer.length
    ? `Declared: ${capability.declaredPeer.join(', ')}`
    : capability.legacyPeerSignals.length
      ? `Legacy tag signal: ${capability.legacyPeerSignals.join(', ')}`
      : 'No declared peer capability or legacy peer/P2P tag is recorded.';
  const runtimePassed =
    runtime?.connected === true && runtime?.handoffReady !== false && Boolean(runtime?.proof);
  const gates = Object.freeze([
    Object.freeze({
      id: 'capability',
      label: 'Peer capability signal',
      passed: signals.length > 0,
      detail: capabilityDetail,
    }),
    Object.freeze({
      id: 'integrity',
      label: 'Cryptographic content hash',
      passed: Boolean(contentHash),
      detail: contentHash || 'No SHA-256 content digest is recorded.',
    }),
    Object.freeze({
      id: 'size',
      label: 'Declared byte size',
      passed: Boolean(sizeBytes),
      detail: sizeBytes ? `${sizeBytes} bytes` : 'No bounded content size is recorded.',
    }),
    Object.freeze({
      id: 'runtime',
      label: 'Healthy live peer session',
      passed: runtimePassed,
      detail: runtimePassed
        ? runtime.label
        : runtime?.reason || 'No healthy live peer session proof.',
    }),
  ]);
  const eligibleForOffer = gates.every((gate) => gate.passed);
  return Object.freeze({
    state: eligibleForOffer ? 'eligible-for-offer' : 'blocked',
    eligibleForOffer,
    contentHash,
    sizeBytes,
    signals: Object.freeze(signals),
    capabilitySource: capability.source,
    gates,
    note: eligibleForOffer
      ? 'Eligible to hand off a bounded descriptor; this is not delivery or verification proof, and it does not persist bytes.'
      : 'Peer handoff stays unavailable until every evidence gate passes.',
  });
}

function requireString(value, field) {
  const result = cleanString(value);
  if (!result) throw new PeerContractError(`${field} must be a non-empty string`);
  return result;
}
export function validatePeerOfferDescriptor(
  offer,
  { now = () => Date.now(), maxBytes, maxTtlMs } = {},
) {
  if (!offer || typeof offer !== 'object' || Array.isArray(offer))
    throw new PeerContractError('Peer offer must be an object');
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)
    throw new PeerContractError('Peer offer validation requires a positive maxBytes policy');
  if (maxTtlMs != null && (!Number.isSafeInteger(maxTtlMs) || maxTtlMs <= 0))
    throw new PeerContractError('Peer offer maxTtlMs must be a positive safe integer');
  if (offer.protocol !== PEER_OFFER_PROTOCOL)
    throw new PeerContractError(`Unsupported peer offer protocol: ${String(offer.protocol)}`);
  const offerId = requireString(offer.offerId, 'offerId');
  const artifactId = requireString(offer.artifactId, 'artifactId');
  const token = requireString(offer.token, 'token');
  const contentHash = requireString(offer.contentHash, 'contentHash').toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(contentHash))
    throw new PeerContractError(
      'contentHash must be sha256:<64 lowercase-or-uppercase hex characters>',
    );
  if (!Number.isSafeInteger(offer.sizeBytes) || offer.sizeBytes <= 0)
    throw new PeerContractError('sizeBytes must be a positive safe integer');
  if (offer.sizeBytes > maxBytes)
    throw new PeerContractError('Peer offer exceeds the configured maxBytes policy', {
      sizeBytes: offer.sizeBytes,
      maxBytes,
    });
  const currentTime = Number(now());
  if (!Number.isFinite(currentTime)) throw new PeerContractError('now must return a finite number');
  if (!Number.isFinite(offer.expiresAt) || offer.expiresAt <= currentTime)
    throw new PeerContractError('Peer offer is expired or has no future expiresAt');
  if (maxTtlMs != null && offer.expiresAt > currentTime + maxTtlMs)
    throw new PeerContractError('Peer offer expires beyond the configured TTL ceiling');
  const targetPeerId =
    offer.targetPeerId == null ? null : requireString(offer.targetPeerId, 'targetPeerId');
  return Object.freeze({
    protocol: PEER_OFFER_PROTOCOL,
    offerId,
    artifactId,
    token,
    contentHash,
    sizeBytes: offer.sizeBytes,
    expiresAt: offer.expiresAt,
    targetPeerId,
  });
}

function base64Url(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('random source must return Uint8Array');
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64url');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
function browserRandomBytes(length) {
  if (!globalThis.crypto?.getRandomValues)
    throw new PeerContractError(
      'Secure browser randomness is unavailable; peer session creation is disabled.',
    );
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}
function defaultNodeId() {
  if (globalThis.crypto?.randomUUID) return `v13-${globalThis.crypto.randomUUID()}`;
  return `v13-${base64Url(browserRandomBytes(18))}`;
}
export function createPeerInvitation({ randomBytes = browserRandomBytes } = {}) {
  const secret = base64Url(randomBytes(24));
  if (secret.length < 22) throw new PeerContractError('Peer invitation entropy is insufficient.');
  return `${PEER_INVITATION_PREFIX}${secret}`;
}
export function parsePeerInvitation(value) {
  const invitation = cleanString(value);
  if (!invitation.startsWith(PEER_INVITATION_PREFIX))
    throw new PeerContractError('Peer invitation has an unsupported format.');
  const secret = invitation.slice(PEER_INVITATION_PREFIX.length);
  if (!/^[A-Za-z0-9_-]{22,128}$/u.test(secret))
    throw new PeerContractError('Peer invitation capability is malformed or undersized.');
  return Object.freeze({ invitation, secret });
}
function boundedPolicy(overrides = {}) {
  const policy = { ...DEFAULT_PEER_POLICY, ...overrides };
  for (const key of [
    'maxPeers',
    'maxMessageBytes',
    'maxQueuedOutbound',
    'maxBufferedBytes',
    'replayWindow',
    'reconnectMaxAttempts',
    'maxOfferBytes',
    'offerTtlMs',
    'maxPresence',
    'maxPendingOffers',
    'maxChatMessages',
    'maxChatChars',
    'maxGameSessions',
    'maxGamePlayers',
    'gameSessionTtlMs',
  ]) {
    if (!Number.isSafeInteger(policy[key]) || policy[key] <= 0)
      throw new PeerContractError(`${key} must be a positive safe integer`);
  }
  if (
    policy.maxPeers > 32 ||
    policy.maxPresence > 32 ||
    policy.maxPendingOffers > 128 ||
    policy.maxChatMessages > 256 ||
    policy.maxChatChars > 2_000 ||
    policy.maxGameSessions > 64 ||
    policy.maxGamePlayers > 16
  )
    throw new PeerContractError('Peer policy exceeds V13Hub bounded-resource ceilings.');
  if (policy.gameSessionTtlMs > 4 * 60 * 60_000)
    throw new PeerContractError('gameSessionTtlMs exceeds the 4 hour V13Hub ceiling.');
  if (policy.offerTtlMs > 10 * 60_000)
    throw new PeerContractError('offerTtlMs exceeds the 10 minute V13Hub ceiling.');
  return Object.freeze(policy);
}
async function importCandidate(specifier, baseUrl) {
  return import(new URL(specifier, baseUrl).href);
}
export async function loadBrowserPeerStack({
  baseUrl = globalThis.location?.href,
  candidates = MODULE_CANDIDATES,
} = {}) {
  if (!baseUrl)
    throw new PeerContractError('A browser base URL is required to locate peer modules.');
  const errors = [];
  for (const candidate of candidates) {
    try {
      const [peernet, peerjslib] = await Promise.all([
        importCandidate(candidate.peernet, baseUrl),
        importCandidate(candidate.peerjslib, baseUrl),
      ]);
      if (
        typeof peernet.PeernetClient !== 'function' ||
        typeof peerjslib.PeerJsLobby !== 'function' ||
        typeof peerjslib.deriveRendezvousRoomId !== 'function'
      )
        throw new Error('candidate modules do not expose PeernetClient/PeerJsLobby/rendezvous');
      return Object.freeze({
        PeernetClient: peernet.PeernetClient,
        PeerJsLobby: peerjslib.PeerJsLobby,
        deriveRendezvousRoomId: peerjslib.deriveRendezvousRoomId,
        source: Object.freeze({ ...candidate }),
      });
    } catch (error) {
      errors.push(String(error?.message || error));
    }
  }
  throw new PeerContractError(
    'The existing PeernetJS/peerjslib runtime is not reachable from this deployment.',
    { errors },
  );
}
function freezeParticipant(participant) {
  return Object.freeze({
    nodeId: participant.nodeId,
    lastSeenAt: participant.lastSeenAt,
    latencyMs: participant.latencyMs ?? null,
    capabilities: Object.freeze([...participant.capabilities].sort()),
    self: participant.self === true,
  });
}

function jsonClone(value) {
  try {
    const encoded = JSON.stringify(value, (_key, item) => {
      const type = typeof item;
      if (
        type === 'undefined' ||
        type === 'function' ||
        type === 'symbol' ||
        type === 'bigint' ||
        (type === 'number' && !Number.isFinite(item))
      ) {
        throw new TypeError(`unsupported JSON value: ${type}`);
      }
      return item;
    });
    if (encoded === undefined) throw new TypeError('value has no JSON representation');
    return JSON.parse(encoded);
  } catch (error) {
    throw new PeerContractError('Shared peer state must be JSON-compatible.', {
      cause: String(error?.message || error),
    });
  }
}

function compareStateStamp(left, right) {
  const leftClock = safeNonNegativeInteger(left?.clock) ?? -1;
  const rightClock = safeNonNegativeInteger(right?.clock) ?? -1;
  if (leftClock !== rightClock) return leftClock - rightClock;
  return cleanString(left?.origin).localeCompare(cleanString(right?.origin));
}

function boundedLobbyString(value, field, maxLength = 160) {
  const result = requireString(value, field);
  if (result.length > maxLength)
    throw new PeerContractError(`${field} exceeds ${maxLength} characters`);
  return result;
}

export function validateGameSessionDescriptor(
  value,
  { now = () => Date.now(), maxPlayers = 8, maxTtlMs = 60 * 60_000 } = {},
) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PeerContractError('Game session descriptor must be an object.');
  if (value.protocol !== PEER_GAME_HANDOFF_PROTOCOL)
    throw new PeerContractError(`Unsupported game session protocol: ${String(value.protocol)}`);
  const gameSessionId = boundedLobbyString(value.gameSessionId, 'gameSessionId', 128);
  const gameId = boundedLobbyString(value.gameId, 'gameId', 160);
  const title = boundedLobbyString(value.title, 'title', 160);
  const hostNodeId = boundedLobbyString(value.hostNodeId, 'hostNodeId', 160);
  if (
    !Number.isSafeInteger(value.maxPlayers) ||
    value.maxPlayers < 1 ||
    value.maxPlayers > maxPlayers
  )
    throw new PeerContractError('Game session maxPlayers exceeds the local policy.');
  if (
    !Array.isArray(value.players) ||
    value.players.length < 1 ||
    value.players.length > value.maxPlayers
  )
    throw new PeerContractError('Game session players must fit the declared capacity.');
  const players = [
    ...new Set(value.players.map((player) => boundedLobbyString(player, 'player', 160))),
  ];
  if (players.length !== value.players.length || !players.includes(hostNodeId))
    throw new PeerContractError('Game session players must be unique and include the host.');
  const createdAt = Number(value.createdAt);
  const expiresAt = Number(value.expiresAt);
  const current = Number(now());
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || !Number.isFinite(current))
    throw new PeerContractError('Game session timestamps must be finite.');
  if (expiresAt <= current || expiresAt > current + maxTtlMs)
    throw new PeerContractError('Game session expiry is outside the local TTL policy.');
  const revision = safeNonNegativeInteger(value.revision);
  if (revision == null) throw new PeerContractError('Game session revision must be non-negative.');
  return Object.freeze({
    protocol: PEER_GAME_HANDOFF_PROTOCOL,
    gameSessionId,
    gameId,
    title,
    hostNodeId,
    maxPlayers: value.maxPlayers,
    players: Object.freeze(players),
    createdAt,
    expiresAt,
    revision,
  });
}

export class PeerSessionRuntime {
  constructor({
    stackLoader = loadBrowserPeerStack,
    now = () => Date.now(),
    randomBytes = browserRandomBytes,
    nodeId = defaultNodeId(),
    policy = {},
  } = {}) {
    this.stackLoader = stackLoader;
    this.now = now;
    this.randomBytes = randomBytes;
    this.nodeId = requireString(nodeId, 'nodeId');
    this.policy = boundedPolicy(policy);
    this.state = 'idle';
    this.sessionId = null;
    this.invitation = null;
    this.client = null;
    this.transport = null;
    this.stackSource = null;
    this.lastError = null;
    this.degradedReason = null;
    this.participants = new Map();
    this.remoteCapabilities = new Map();
    this.pendingOffers = [];
    this.seenOfferExpiries = new Map();
    this.chatMessages = [];
    this.gameSessions = new Map();
    this.pendingGameHandoff = null;
    this.sharedState = undefined;
    this.sharedStateStamp = Object.freeze({ clock: 0, origin: this.nodeId });
    this.logicalClock = 0;
    this.latencyProbes = new Map();
    this.listeners = new Set();
    this.unsubscribers = [];
    this.connectPromise = null;
    this.localCapabilities = Object.freeze([
      PEER_CAPABILITIES.PRESENCE,
      PEER_CAPABILITIES.NEGOTIATION,
      PEER_CAPABILITIES.ARTIFACT_OFFER,
      PEER_CAPABILITIES.STATE_SYNC,
      PEER_CAPABILITIES.GAME_LOBBY,
      PEER_CAPABILITIES.LOBBY_CHAT,
    ]);
  }
  onChange(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  _emit() {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        /* UI observers cannot destabilize the session. */
      }
    }
  }
  _setState(state) {
    this.state = state;
    this._emit();
  }
  _touchParticipant(nodeId, capabilities = [], { latencyMs } = {}) {
    const id = requireString(nodeId, 'nodeId');
    if (!this.participants.has(id) && this.participants.size >= this.policy.maxPresence)
      return false;
    const normalizedCaps = [...new Set(capabilities.map(cleanString).filter(Boolean))].slice(0, 32);
    const previous = this.participants.get(id);
    this.participants.set(id, {
      nodeId: id,
      lastSeenAt: Number(this.now()),
      capabilities: normalizedCaps,
      latencyMs:
        Number.isFinite(latencyMs) && latencyMs >= 0
          ? Math.round(latencyMs)
          : (previous?.latencyMs ?? null),
      self: id === this.nodeId,
    });
    if (id !== this.nodeId) this.remoteCapabilities.set(id, new Set(normalizedCaps));
    return true;
  }
  _removeParticipant(nodeId) {
    this.participants.delete(nodeId);
    this.remoteCapabilities.delete(nodeId);
    for (const [gameSessionId, session] of this.gameSessions) {
      if (session.hostNodeId === nodeId) {
        this.gameSessions.delete(gameSessionId);
        continue;
      }
      if (session.hostNodeId !== this.nodeId || !session.players.includes(nodeId)) continue;
      const updated = Object.freeze({
        ...session,
        players: Object.freeze(session.players.filter((player) => player !== nodeId)),
        revision: session.revision + 1,
      });
      this.gameSessions.set(gameSessionId, updated);
      void this._broadcastGameSession(updated).catch(() => {});
    }
  }
  _wireClient(client) {
    const subscribe = (event, handler) => {
      const unsubscribe = client.on(event, handler);
      if (typeof unsubscribe === 'function') this.unsubscribers.push(unsubscribe);
    };
    subscribe('state', ({ state, previous }) => {
      this.state = cleanString(state) || this.state;
      if (state === 'online') this.lastError = null;
      this._emit();
      if (state === 'online' && previous === 'reconnecting') {
        void this._announce().catch((error) => {
          this.lastError = String(error?.message || error);
          this._emit();
        });
      }
    });
    subscribe('error', (error) => {
      this.lastError = String(error?.message || error);
      this._emit();
    });
    subscribe('replay-gap', () => {
      this.degradedReason =
        'Replay history gap detected; artifact handoff is blocked until a new session is established.';
      this._emit();
    });
    subscribe('backpressure', () => {
      this.degradedReason =
        'Transport backpressure detected; artifact handoff is blocked until a new session is established.';
      this._emit();
    });
    subscribe(`message:${TOPICS.PRESENCE}`, ({ from, payload }) =>
      this._receivePresence(from, payload),
    );
    subscribe(`message:${TOPICS.CAPABILITIES}`, ({ from, payload }) =>
      this._receiveCapabilities(from, payload),
    );
    subscribe(`message:${TOPICS.OFFER}`, ({ from, payload }) => this._receiveOffer(from, payload));
    subscribe(`message:${TOPICS.LATENCY_PING}`, ({ from, payload }) =>
      this._receiveLatencyPing(from, payload),
    );
    subscribe(`message:${TOPICS.LATENCY_PONG}`, ({ from, payload }) =>
      this._receiveLatencyPong(from, payload),
    );
    subscribe(`message:${TOPICS.STATE}`, ({ from, payload }) =>
      this._receiveSharedState(from, payload),
    );
    subscribe(`message:${TOPICS.CHAT}`, ({ from, payload }) => this._receiveChat(from, payload));
    subscribe(`message:${TOPICS.GAME_SESSION}`, ({ from, payload }) =>
      this._receiveGameSession(from, payload),
    );
    subscribe(`message:${TOPICS.GAME_JOIN}`, ({ from, payload }) =>
      this._receiveGameJoin(from, payload),
    );
    subscribe(`message:${TOPICS.GAME_LEAVE}`, ({ from, payload }) =>
      this._receiveGameLeave(from, payload),
    );
    subscribe(`message:${TOPICS.GAME_HANDOFF}`, ({ from, payload }) =>
      this._receiveGameHandoff(from, payload),
    );
  }
  _validSessionPayload(payload) {
    return (
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      payload.protocol === PEER_SESSION_PROTOCOL &&
      payload.sessionId === this.sessionId
    );
  }
  _receivePresence(from, payload) {
    if (!this._validSessionPayload(payload)) return;
    if (payload.kind === 'leave') {
      this._removeParticipant(from);
      this._emit();
      return;
    }
    this._touchParticipant(from, Array.isArray(payload.capabilities) ? payload.capabilities : []);
    if (from !== this.nodeId && this.client && this.state === 'online') {
      void this.client
        .send(from, TOPICS.CAPABILITIES, {
          protocol: PEER_SESSION_PROTOCOL,
          sessionId: this.sessionId,
          capabilities: [...this.localCapabilities],
        })
        .then(async () => {
          await this._broadcastSharedState(from);
          await this._broadcastHostedGames(from);
          await this.probeLatency(from);
        })
        .catch((error) => {
          this.lastError = String(error?.message || error);
          this._emit();
        });
    }
    this._emit();
  }
  _receiveCapabilities(from, payload) {
    if (!this._validSessionPayload(payload) || !Array.isArray(payload.capabilities)) return;
    this._touchParticipant(from, payload.capabilities);
    this._emit();
  }
  _receiveLatencyPing(from, payload) {
    if (!this._validSessionPayload(payload) || !Number.isFinite(payload.sentAt)) return;
    this._touchParticipant(from, this.capabilitiesFor(from));
    if (!this.client || this.state !== 'online') return;
    void this.client
      .send(from, TOPICS.LATENCY_PONG, {
        protocol: PEER_SESSION_PROTOCOL,
        sessionId: this.sessionId,
        probeId: cleanString(payload.probeId),
        sentAt: payload.sentAt,
      })
      .catch((error) => {
        this.lastError = String(error?.message || error);
        this._emit();
      });
  }
  _receiveLatencyPong(from, payload) {
    if (!this._validSessionPayload(payload)) return;
    const probeId = cleanString(payload.probeId);
    const probe = this.latencyProbes.get(probeId);
    if (!probeId || !probe || probe.targetPeerId !== from) return;
    this.latencyProbes.delete(probeId);
    this._touchParticipant(from, this.capabilitiesFor(from), {
      latencyMs: Math.max(0, Number(this.now()) - probe.sentAt),
    });
    this._emit();
  }
  _receiveSharedState(from, payload) {
    if (!this._validSessionPayload(payload) || !payload.stamp || !('value' in payload)) return;
    if (!this.capabilitiesFor(from).includes(PEER_CAPABILITIES.STATE_SYNC)) return;
    const clock = safeNonNegativeInteger(payload.stamp.clock);
    const origin = cleanString(payload.stamp.origin);
    if (clock == null || !origin) return;
    this.logicalClock = Math.max(this.logicalClock, clock);
    const stamp = Object.freeze({ clock, origin });
    if (compareStateStamp(stamp, this.sharedStateStamp) <= 0) return;
    try {
      this.sharedState = Object.freeze(jsonClone(payload.value));
      this.sharedStateStamp = stamp;
      this._touchParticipant(from, this.capabilitiesFor(from));
      this._emit();
    } catch {
      /* malformed shared state remains untrusted */
    }
  }
  _receiveOffer(from, payload) {
    if (!this._validSessionPayload(payload)) return;
    if (!this.capabilitiesFor(from).includes(PEER_CAPABILITIES.ARTIFACT_OFFER)) return;
    try {
      const offer = validatePeerOfferDescriptor(payload.offer, {
        now: this.now,
        maxBytes: this.policy.maxOfferBytes,
        maxTtlMs: this.policy.offerTtlMs,
      });
      if (offer.targetPeerId !== this.nodeId) return;
      const replayKey = `${from}\u0000${offer.offerId}`;
      const currentTime = Number(this.now());
      for (const [key, expiresAt] of this.seenOfferExpiries) {
        if (expiresAt <= currentTime) this.seenOfferExpiries.delete(key);
      }
      if (this.seenOfferExpiries.has(replayKey)) return;
      if (this.seenOfferExpiries.size >= this.policy.replayWindow) return;
      this.seenOfferExpiries.set(replayKey, offer.expiresAt);
      if (this.pendingOffers.length >= this.policy.maxPendingOffers) this.pendingOffers.shift();
      this.pendingOffers.push(Object.freeze({ from, receivedAt: this.now(), offer }));
      this._emit();
    } catch {
      /* Invalid or stale offers stay untrusted and invisible. */
    }
  }
  _pruneLobbyState() {
    const current = Number(this.now());
    for (const [gameSessionId, session] of this.gameSessions) {
      if (session.expiresAt <= current) this.gameSessions.delete(gameSessionId);
    }
  }
  _receiveChat(from, payload) {
    if (
      !this._validSessionPayload(payload) ||
      !this.capabilitiesFor(from).includes(PEER_CAPABILITIES.LOBBY_CHAT)
    )
      return;
    try {
      const text = boundedLobbyString(payload.text, 'chat text', this.policy.maxChatChars);
      const messageId = boundedLobbyString(payload.messageId, 'messageId', 160);
      if (cleanString(payload.from) !== from || !Number.isFinite(payload.sentAt)) return;
      if (this.chatMessages.some((message) => message.messageId === messageId)) return;
      if (this.chatMessages.length >= this.policy.maxChatMessages) this.chatMessages.shift();
      this.chatMessages.push(
        Object.freeze({ messageId, from, text, sentAt: Number(payload.sentAt), self: false }),
      );
      this._touchParticipant(from, this.capabilitiesFor(from));
      this._emit();
    } catch {
      /* malformed chat remains untrusted */
    }
  }
  _receiveGameSession(from, payload) {
    if (
      !this._validSessionPayload(payload) ||
      !this.capabilitiesFor(from).includes(PEER_CAPABILITIES.GAME_LOBBY)
    )
      return;
    const gameSessionId = cleanString(payload.gameSessionId || payload.gameSession?.gameSessionId);
    if (payload.kind === 'closed') {
      const existing = this.gameSessions.get(gameSessionId);
      if (existing?.hostNodeId === from) {
        this.gameSessions.delete(gameSessionId);
        if (this.pendingGameHandoff?.gameSessionId === gameSessionId)
          this.pendingGameHandoff = null;
        this._emit();
      }
      return;
    }
    try {
      const session = validateGameSessionDescriptor(payload.gameSession, {
        now: this.now,
        maxPlayers: this.policy.maxGamePlayers,
        maxTtlMs: this.policy.gameSessionTtlMs,
      });
      if (session.hostNodeId !== from) return;
      const current = this.gameSessions.get(session.gameSessionId);
      if (current && current.hostNodeId !== from) return;
      if (current && current.revision >= session.revision) return;
      if (!current && this.gameSessions.size >= this.policy.maxGameSessions) return;
      this.gameSessions.set(session.gameSessionId, session);
      this._touchParticipant(from, this.capabilitiesFor(from));
      this._emit();
    } catch {
      /* invalid remote game advertisements remain invisible */
    }
  }
  _receiveGameJoin(from, payload) {
    if (!this._validSessionPayload(payload)) return;
    const gameSessionId = cleanString(payload.gameSessionId);
    const session = this.gameSessions.get(gameSessionId);
    if (!session || session.hostNodeId !== this.nodeId || from === this.nodeId) return;
    if (!this.capabilitiesFor(from).includes(PEER_CAPABILITIES.GAME_LOBBY)) return;
    if (session.players.includes(from)) {
      void this._sendGameHandoff(session, from).catch(() => {});
      return;
    }
    if (session.players.length >= session.maxPlayers) return;
    const updated = Object.freeze({
      ...session,
      players: Object.freeze([...session.players, from]),
      revision: session.revision + 1,
    });
    this.gameSessions.set(gameSessionId, updated);
    void this._broadcastGameSession(updated)
      .then(() => this._sendGameHandoff(updated, from))
      .catch((error) => {
        this.lastError = String(error?.message || error);
        this._emit();
      });
    this._emit();
  }
  _receiveGameLeave(from, payload) {
    if (!this._validSessionPayload(payload)) return;
    const gameSessionId = cleanString(payload.gameSessionId);
    const session = this.gameSessions.get(gameSessionId);
    if (!session || session.hostNodeId !== this.nodeId || !session.players.includes(from)) return;
    const updated = Object.freeze({
      ...session,
      players: Object.freeze(session.players.filter((player) => player !== from)),
      revision: session.revision + 1,
    });
    this.gameSessions.set(gameSessionId, updated);
    void this._broadcastGameSession(updated).catch(() => {});
    this._emit();
  }
  _receiveGameHandoff(from, payload) {
    if (
      !this._validSessionPayload(payload) ||
      payload.handoffProtocol !== PEER_GAME_HANDOFF_PROTOCOL
    )
      return;
    try {
      const session = validateGameSessionDescriptor(payload.gameSession, {
        now: this.now,
        maxPlayers: this.policy.maxGamePlayers,
        maxTtlMs: this.policy.gameSessionTtlMs,
      });
      if (session.hostNodeId !== from || !session.players.includes(this.nodeId)) return;
      this.gameSessions.set(session.gameSessionId, session);
      this.pendingGameHandoff = Object.freeze({
        protocol: PEER_GAME_HANDOFF_PROTOCOL,
        gameSessionId: session.gameSessionId,
        gameId: session.gameId,
        transportSessionId: this.sessionId,
        hostNodeId: session.hostNodeId,
        nodeId: this.nodeId,
        players: session.players,
        receivedAt: Number(this.now()),
      });
      this._emit();
    } catch {
      /* invalid handoff remains untrusted */
    }
  }
  async _broadcastGameSession(session, targetPeerId = null) {
    if (!this.client || this.state !== 'online') return null;
    const payload = {
      protocol: PEER_SESSION_PROTOCOL,
      sessionId: this.sessionId,
      kind: 'upsert',
      gameSession: session,
    };
    return targetPeerId
      ? this.client.send(targetPeerId, TOPICS.GAME_SESSION, payload)
      : this.client.broadcast(TOPICS.GAME_SESSION, payload);
  }
  async _broadcastHostedGames(targetPeerId = null) {
    this._pruneLobbyState();
    const hosted = [...this.gameSessions.values()].filter(
      (session) => session.hostNodeId === this.nodeId,
    );
    return Promise.all(hosted.map((session) => this._broadcastGameSession(session, targetPeerId)));
  }
  async _sendGameHandoff(gameSession, targetPeerId) {
    if (!this.client || this.state !== 'online') return null;
    return this.client.send(targetPeerId, TOPICS.GAME_HANDOFF, {
      protocol: PEER_SESSION_PROTOCOL,
      handoffProtocol: PEER_GAME_HANDOFF_PROTOCOL,
      sessionId: this.sessionId,
      gameSession,
    });
  }
  async _announce() {
    if (!this.client || this.state !== 'online') return;
    const payload = {
      protocol: PEER_SESSION_PROTOCOL,
      sessionId: this.sessionId,
      kind: 'present',
      capabilities: [...this.localCapabilities],
    };
    await this.client.broadcast(TOPICS.PRESENCE, payload);
    await this.client.broadcast(TOPICS.CAPABILITIES, payload);
    await this._broadcastSharedState();
    await this._broadcastHostedGames();
    await this.probeLatency();
  }
  async _broadcastSharedState(targetPeerId = null) {
    if (!this.client || this.state !== 'online' || this.sharedState === undefined) return null;
    const payload = {
      protocol: PEER_SESSION_PROTOCOL,
      sessionId: this.sessionId,
      stamp: this.sharedStateStamp,
      value: this.sharedState,
    };
    return targetPeerId
      ? this.client.send(targetPeerId, TOPICS.STATE, payload)
      : this.client.broadcast(TOPICS.STATE, payload);
  }
  async probeLatency(targetPeerId = null) {
    if (!this.client || this.state !== 'online') return null;
    const targets = targetPeerId
      ? [requireString(targetPeerId, 'targetPeerId')]
      : [...this.participants.keys()].filter((nodeId) => nodeId !== this.nodeId);
    const sends = targets.map((target) => {
      const sentAt = Number(this.now());
      const probeId = `probe-${this.nodeId}-${++this.logicalClock}`;
      if (this.latencyProbes.size >= this.policy.maxPresence * 2) {
        const oldest = this.latencyProbes.keys().next().value;
        if (oldest) this.latencyProbes.delete(oldest);
      }
      this.latencyProbes.set(probeId, { sentAt, targetPeerId: target });
      return this.client.send(target, TOPICS.LATENCY_PING, {
        protocol: PEER_SESSION_PROTOCOL,
        sessionId: this.sessionId,
        probeId,
        sentAt,
      });
    });
    return targetPeerId ? sends[0] || null : Promise.all(sends);
  }
  async _open(invitation, { created }) {
    if (this.connectPromise) return this.connectPromise;
    if (this.client)
      throw new PeerContractError('Close the current peer session before opening another.');
    const parsed = parsePeerInvitation(invitation);
    const attempt = (async () => {
      this._setState('connecting');
      try {
        const stack = await this.stackLoader();
        const roomId = await stack.deriveRendezvousRoomId(parsed.secret, {
          namespace: SESSION_NAMESPACE,
        });
        this.sessionId = requireString(roomId, 'sessionId');
        this.invitation = created ? parsed.invitation : null;
        this.stackSource = stack.source || null;
        this.transport = new stack.PeerJsLobby(this.sessionId, {
          maxPeers: this.policy.maxPeers,
          maxMessageBytes: this.policy.maxMessageBytes,
          maxQueuedOutbound: this.policy.maxQueuedOutbound,
          maxBufferedBytes: this.policy.maxBufferedBytes,
          replayWindow: this.policy.replayWindow,
          ackTimeoutMs: this.policy.ackTimeoutMs,
          handshakeTimeoutMs: this.policy.handshakeTimeoutMs,
          heartbeatIntervalMs: this.policy.heartbeatIntervalMs,
          staleAfterMs: this.policy.staleAfterMs,
          reconnectBaseDelayMs: this.policy.reconnectBaseDelayMs,
          reconnectMaxDelayMs: this.policy.reconnectMaxDelayMs,
          reconnectMaxAttempts: this.policy.reconnectMaxAttempts,
          reconnectJitterRatio: this.policy.reconnectJitterRatio,
        });
        this.client = new stack.PeernetClient({
          nodeId: this.nodeId,
          transport: this.transport,
          maxMessageBytes: this.policy.maxMessageBytes,
          now: this.now,
        });
        this._wireClient(this.client);
        const connected = await this.client.connect();
        if (connected !== true)
          throw new PeerContractError('PeernetJS did not reach an online state.');
        this.state = 'online';
        this._touchParticipant(this.nodeId, this.localCapabilities);
        await this._announce();
        this._emit();
        return this.snapshot();
      } catch (error) {
        this.lastError = String(error?.message || error);
        this.state = 'offline';
        if (this.client) {
          try {
            await this.client.close();
          } catch {
            /* preserve startup error */
          }
        }
        this.client = null;
        this.transport = null;
        this._emit();
        throw error;
      }
    })();
    this.connectPromise = attempt;
    try {
      return await attempt;
    } finally {
      if (this.connectPromise === attempt) this.connectPromise = null;
    }
  }
  createSession() {
    return this._open(createPeerInvitation({ randomBytes: this.randomBytes }), { created: true });
  }
  joinSession(invitation) {
    return this._open(invitation, { created: false });
  }
  capabilitiesFor(nodeId) {
    return Object.freeze([...(this.remoteCapabilities.get(nodeId) || new Set())].sort());
  }
  capablePeers(capability = PEER_CAPABILITIES.ARTIFACT_OFFER) {
    return Object.freeze(
      [...this.remoteCapabilities.entries()]
        .filter(([, caps]) => caps.has(capability))
        .map(([nodeId]) => nodeId)
        .sort(),
    );
  }
  getSharedState() {
    return Object.freeze({
      value: this.sharedState === undefined ? null : jsonClone(this.sharedState),
      stamp: this.sharedStateStamp,
    });
  }
  async setSharedState(value) {
    const nextValue = Object.freeze(jsonClone(value));
    this.logicalClock += 1;
    this.sharedState = nextValue;
    this.sharedStateStamp = Object.freeze({ clock: this.logicalClock, origin: this.nodeId });
    this._emit();
    if (!this.client || this.state !== 'online') return null;
    return this._broadcastSharedState();
  }
  async sendChat(text) {
    if (!this.client || this.state !== 'online')
      throw new PeerContractError('Join a peer session before sending lobby chat.');
    const value = boundedLobbyString(text, 'chat text', this.policy.maxChatChars);
    const message = Object.freeze({
      messageId: `chat-${this.nodeId}-${++this.logicalClock}`,
      from: this.nodeId,
      text: value,
      sentAt: Number(this.now()),
      self: true,
    });
    if (this.chatMessages.length >= this.policy.maxChatMessages) this.chatMessages.shift();
    this.chatMessages.push(message);
    this._emit();
    const receipt = await this.client.broadcast(TOPICS.CHAT, {
      protocol: PEER_SESSION_PROTOCOL,
      sessionId: this.sessionId,
      ...message,
    });
    return Object.freeze({ message, receipt });
  }
  async hostGame({ gameId, title, maxPlayers = 4 }) {
    if (!this.client || this.state !== 'online')
      throw new PeerContractError('Join a peer session before hosting a game.');
    const capacity = Number(maxPlayers);
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > this.policy.maxGamePlayers)
      throw new PeerContractError('Game capacity exceeds the local policy.');
    this._pruneLobbyState();
    if (this.gameSessions.size >= this.policy.maxGameSessions)
      throw new PeerContractError('Lobby game-session capacity is full.');
    const createdAt = Number(this.now());
    const gameSession = validateGameSessionDescriptor(
      {
        protocol: PEER_GAME_HANDOFF_PROTOCOL,
        gameSessionId: `game-${base64Url(this.randomBytes(18))}`,
        gameId,
        title,
        hostNodeId: this.nodeId,
        maxPlayers: capacity,
        players: [this.nodeId],
        createdAt,
        expiresAt: createdAt + this.policy.gameSessionTtlMs,
        revision: 1,
      },
      {
        now: this.now,
        maxPlayers: this.policy.maxGamePlayers,
        maxTtlMs: this.policy.gameSessionTtlMs,
      },
    );
    this.gameSessions.set(gameSession.gameSessionId, gameSession);
    await this._broadcastGameSession(gameSession);
    this._emit();
    return gameSession;
  }
  async joinGame(gameSessionId) {
    if (!this.client || this.state !== 'online')
      throw new PeerContractError('Join a peer session before joining a game.');
    this._pruneLobbyState();
    const id = requireString(gameSessionId, 'gameSessionId');
    const session = this.gameSessions.get(id);
    if (!session) throw new PeerContractError('Game session is no longer advertised.');
    if (session.players.includes(this.nodeId)) return this.gameHandoffFor(id);
    if (session.players.length >= session.maxPlayers)
      throw new PeerContractError('Game session is full.');
    if (!this.capabilitiesFor(session.hostNodeId).includes(PEER_CAPABILITIES.GAME_LOBBY))
      throw new PeerContractError('Game host has not negotiated game-lobby-v1.');
    return this.client.send(session.hostNodeId, TOPICS.GAME_JOIN, {
      protocol: PEER_SESSION_PROTOCOL,
      sessionId: this.sessionId,
      gameSessionId: id,
    });
  }
  async leaveGame(gameSessionId) {
    const id = requireString(gameSessionId, 'gameSessionId');
    const session = this.gameSessions.get(id);
    if (!session) return null;
    if (session.hostNodeId === this.nodeId) {
      this.gameSessions.delete(id);
      if (this.client && this.state === 'online')
        await this.client.broadcast(TOPICS.GAME_SESSION, {
          protocol: PEER_SESSION_PROTOCOL,
          sessionId: this.sessionId,
          kind: 'closed',
          gameSessionId: id,
        });
      this._emit();
      return null;
    }
    if (session.players.includes(this.nodeId) && this.client && this.state === 'online')
      await this.client.send(session.hostNodeId, TOPICS.GAME_LEAVE, {
        protocol: PEER_SESSION_PROTOCOL,
        sessionId: this.sessionId,
        gameSessionId: id,
      });
    this.gameSessions.delete(id);
    if (this.pendingGameHandoff?.gameSessionId === id) this.pendingGameHandoff = null;
    this._emit();
    return null;
  }
  gameHandoffFor(gameSessionId) {
    const id = requireString(gameSessionId, 'gameSessionId');
    const session = this.gameSessions.get(id);
    if (!session?.players.includes(this.nodeId)) return null;
    return Object.freeze({
      protocol: PEER_GAME_HANDOFF_PROTOCOL,
      gameSessionId: id,
      gameId: session.gameId,
      transportSessionId: this.sessionId,
      hostNodeId: session.hostNodeId,
      nodeId: this.nodeId,
      players: session.players,
    });
  }
  waitForGameHandoff(gameSessionId, { timeoutMs = 6_000 } = {}) {
    const immediate = this.gameHandoffFor(gameSessionId);
    if (immediate) return Promise.resolve(immediate);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
      return Promise.reject(new PeerContractError('timeoutMs must be a positive safe integer.'));
    return new Promise((resolve, reject) => {
      let timer = null;
      const stop = this.onChange(() => {
        const handoff = this.gameHandoffFor(gameSessionId);
        if (!handoff) return;
        if (timer) clearTimeout(timer);
        stop();
        resolve(handoff);
      });
      timer = setTimeout(() => {
        stop();
        reject(new PeerContractError('Timed out waiting for the game host handoff.'));
      }, timeoutMs);
    });
  }
  async offerArtifact(item, targetPeerId) {
    if (!this.client || this.state !== 'online')
      throw new PeerContractError(
        'A healthy online peer session is required for artifact handoff.',
      );
    const target = requireString(targetPeerId, 'targetPeerId');
    if (!this.remoteCapabilities.get(target)?.has(PEER_CAPABILITIES.ARTIFACT_OFFER))
      throw new PeerContractError('Target peer has not negotiated artifact-offer-v1 capability.');
    const readiness = peerCollectionReadiness(item, normalizePeerRuntime(this));
    if (!readiness.eligibleForOffer)
      throw new PeerContractError('Artifact does not satisfy the current peer handoff gates.', {
        blocked: readiness.gates.filter((gate) => !gate.passed).map((gate) => gate.id),
      });
    if (readiness.sizeBytes > this.policy.maxOfferBytes)
      throw new PeerContractError('Artifact exceeds the configured peer-offer byte ceiling.');
    const offer = validatePeerOfferDescriptor(
      {
        protocol: PEER_OFFER_PROTOCOL,
        offerId: `offer-${base64Url(this.randomBytes(18))}`,
        artifactId: item.id,
        token: base64Url(this.randomBytes(24)),
        contentHash: readiness.contentHash,
        sizeBytes: readiness.sizeBytes,
        expiresAt: Number(this.now()) + this.policy.offerTtlMs,
        targetPeerId: target,
      },
      {
        now: this.now,
        maxBytes: this.policy.maxOfferBytes,
        maxTtlMs: this.policy.offerTtlMs,
      },
    );
    const receipt = await this.client.send(target, TOPICS.OFFER, {
      protocol: PEER_SESSION_PROTOCOL,
      sessionId: this.sessionId,
      offer,
    });
    return Object.freeze({ offer, receipt });
  }
  getHealth() {
    let clientHealth = {};
    try {
      clientHealth = this.client?.health?.() || {};
    } catch (error) {
      this.lastError = String(error?.message || error);
    }
    const connected = this.state === 'online' && clientHealth.connected === true;
    const transport = clientHealth.transport || this.transport?.getHealth?.() || {};
    return Object.freeze({
      state: this.state,
      connected,
      handoffReady: connected && !this.degradedReason,
      degradedReason: this.degradedReason,
      peerCount: connected ? Math.max(0, this.participants.size - 1) : 0,
      nodeId: this.nodeId,
      sessionId: this.sessionId,
      negotiatedPeers: this.capablePeers().length,
      stateSyncPeers: this.capablePeers(PEER_CAPABILITIES.STATE_SYNC).length,
      transport,
      lastError: this.lastError || clientHealth.lastError || transport.lastError || null,
    });
  }
  snapshot() {
    this._pruneLobbyState();
    return Object.freeze({
      state: this.state,
      nodeId: this.nodeId,
      sessionId: this.sessionId,
      invitation: this.invitation,
      connected: this.getHealth().connected,
      degradedReason: this.degradedReason,
      participants: Object.freeze([...this.participants.values()].map(freezeParticipant)),
      capablePeers: this.capablePeers(),
      pendingOffers: Object.freeze([...this.pendingOffers]),
      chatMessages: Object.freeze([...this.chatMessages]),
      gameSessions: Object.freeze([...this.gameSessions.values()]),
      pendingGameHandoff: this.pendingGameHandoff,
      sharedState: this.getSharedState(),
      localCapabilities: this.localCapabilities,
      stackSource: this.stackSource,
    });
  }
  async close() {
    if (!this.client) {
      this.state = 'idle';
      this.sessionId = null;
      this.invitation = null;
      this.degradedReason = null;
      this.participants.clear();
      this.remoteCapabilities.clear();
      this.pendingOffers.length = 0;
      this.seenOfferExpiries.clear();
      this.chatMessages.length = 0;
      this.gameSessions.clear();
      this.pendingGameHandoff = null;
      this.latencyProbes.clear();
      this.sharedState = undefined;
      this.sharedStateStamp = Object.freeze({ clock: 0, origin: this.nodeId });
      this.logicalClock = 0;
      this._emit();
      return;
    }
    try {
      if (this.state === 'online')
        await this.client.broadcast(TOPICS.PRESENCE, {
          protocol: PEER_SESSION_PROTOCOL,
          sessionId: this.sessionId,
          kind: 'leave',
          capabilities: [],
        });
    } catch {
      /* leave presence is best effort */
    }
    await this.client.close();
    for (const unsubscribe of this.unsubscribers.splice(0)) {
      try {
        unsubscribe();
      } catch {
        /* cleanup */
      }
    }
    this.client = null;
    this.transport = null;
    this.state = 'idle';
    this.sessionId = null;
    this.invitation = null;
    this.degradedReason = null;
    this.lastError = null;
    this.participants.clear();
    this.remoteCapabilities.clear();
    this.pendingOffers.length = 0;
    this.seenOfferExpiries.clear();
    this.chatMessages.length = 0;
    this.gameSessions.clear();
    this.pendingGameHandoff = null;
    this.latencyProbes.clear();
    this.sharedState = undefined;
    this.sharedStateStamp = Object.freeze({ clock: 0, origin: this.nodeId });
    this.logicalClock = 0;
    this._emit();
  }
}
export function createPeerSessionRuntime(options = {}) {
  return new PeerSessionRuntime(options);
}
