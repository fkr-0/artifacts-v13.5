import { PeernetLobby } from "../../peernetjs/peernet-lib.js";

function createEmitter() {
  const listeners = new Map();
  return {
    on(type, fn) {
      listeners.set(type, [...(listeners.get(type) || []), fn]);
      return () => {
        listeners.set(type, (listeners.get(type) || []).filter((listener) => listener !== fn));
      };
    },
    emit(type, payload) {
      for (const fn of listeners.get(type) || []) {
        try {
          fn(payload);
        } catch (error) {
          console.warn(`[AppHubNetwork:${type}]`, error);
        }
      }
    },
  };
}

function normalizePeers(input) {
  if (!input) return new Map();
  if (input instanceof Map) return new Map(input);
  if (Array.isArray(input)) return new Map(input);
  if (typeof input === "object") return new Map(Object.entries(input));
  return new Map();
}

export function createNoopNetwork() {
  const emitter = createEmitter();
  const health = Object.freeze({
    state: "offline",
    connected: false,
    role: "local",
    lobbyId: null,
    myId: "local",
    peerCount: 0,
    reconnectAttempts: 0,
    lastError: null,
    changedAt: Date.now(),
    messagesSent: 0,
    messagesReceived: 0,
    messagesDropped: 0,
  });
  return {
    on: emitter.on,
    get status() {
      return "offline";
    },
    get peers() {
      return new Map();
    },
    get myId() {
      return "local";
    },
    get isHub() {
      return true;
    },
    get health() {
      return health;
    },
    get diagnostics() {
      return Object.freeze({ ...health, transitions: [] });
    },
    send(peerId, type, payload) {
      return { peerId, type, payload, delivered: false, peerCount: 0, localOnly: true };
    },
    broadcast(type, payload) {
      return { type, payload, localOnly: true };
    },
    reconnect() {
      return Promise.resolve(health);
    },
    destroy() {},
  };
}

export function createLobbyNetwork({
  lobbyId = "nexus-v11-hub-main",
  username = "pilot",
  storageKey = "v11-peernet",
  debug = false,
} = {}) {
  const emitter = createEmitter();
  const lobby = new PeernetLobby(lobbyId, { storageKey, debug });
  let status = "connecting";
  let peers = new Map();
  let health = lobby.health;

  lobby.addEventListener("status", (event) => {
    const detail = event.detail || {};
    status = detail.text || status;
    emitter.emit("status", detail);
  });
  lobby.addEventListener("peers", (event) => {
    peers = normalizePeers(event.detail);
    emitter.emit("peers", peers);
  });
  lobby.addEventListener("health", (event) => {
    health = event.detail || lobby.health;
    emitter.emit("health", health);
  });
  lobby.addEventListener("data", (event) => {
    const detail = event.detail || {};
    const data = detail.data || {};
    emitter.emit("data", detail);
    if (typeof data.type === "string") {
      emitter.emit(`message:${data.type}`, {
        id: detail.from || "",
        payload: data.payload,
        raw: data,
      });
    }
  });
  lobby.addEventListener("storage-error", (event) => {
    emitter.emit("storage-error", event.detail || {});
  });
  lobby.addEventListener("connection-error", (event) => {
    emitter.emit("connection-error", event.detail || {});
  });

  lobby.connect(username).catch((error) => {
    status = `offline: ${error?.message || error}`;
    emitter.emit("status", { connected: false, text: status });
  });

  return {
    on: emitter.on,
    get status() {
      return status;
    },
    get peers() {
      return peers;
    },
    get myId() {
      return lobby.myId || "";
    },
    get isHub() {
      return Boolean(lobby.isHub);
    },
    get health() {
      return health || lobby.health;
    },
    get diagnostics() {
      return lobby.diagnostics || { ...(health || lobby.health), transitions: [] };
    },
    setUsername(nextUsername) {
      username = nextUsername || username;
      if (typeof lobby.setUsername === "function") lobby.setUsername(username);
    },
    send(peerId, type, payload) {
      const packet = { type, payload, fromName: username, at: Date.now() };
      const delivered = lobby.send(peerId, packet);
      return { type, payload, peerId, delivered, peerCount: delivered ? 1 : 0, localOnly: false };
    },
    broadcast(type, payload) {
      const packet = { type, payload, fromName: username, at: Date.now() };
      const delivered = lobby.broadcast(packet);
      return { type, payload, delivered, localOnly: false };
    },
    reconnect() {
      return lobby.reconnect();
    },
    destroy() {
      lobby.destroy();
    },
  };
}
