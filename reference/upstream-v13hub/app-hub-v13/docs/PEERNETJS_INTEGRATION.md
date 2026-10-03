# PeernetJS integration audit

## Runtime ownership map

V13Hub keeps its public peer/session surface in `lib/peer.js`, while the networking stack is split into two existing libraries:

| V13 concern | PeernetJS / peerjslib seam | Adoption |
| --- | --- | --- |
| create/join lifecycle | `PeernetClient.connect()/close()` over `PeerJsLobby` | direct |
| bounded application messages | `PeernetClient.send()/broadcast()` | direct |
| reconnect state | PeernetJS maps lobby `reconnecting -> online/offline` | direct; V13 re-announces presence/state when online returns |
| transport queue/replay/backpressure | peerjslib health + PeernetJS delivery events | direct |
| lobby discovery/rendezvous | `deriveRendezvousRoomId()` + `PeerJsLobby` | adapter: invitation capability -> room id |
| presence/capability negotiation | PeernetJS topics | V13 adapter/protocol |
| latency indicator | PeernetJS logical send/broadcast | V13 ping/pong adapter |
| artifact descriptor handoff | PeernetJS targeted logical send | V13 validation/capability adapter |
| game directory + chat | PeernetJS broadcast/targeted topics over peerjslib v0.4.0 | V13 bounded lobby protocol |
| game handoff | host-accepted player membership in the existing room | V13 `v13hub.game-handoff/v1` launch contract |
| shared artifact state | PeernetJS topic routing | V13 Lamport-stamped last-writer-wins adapter |

PeernetJS deliberately does not own application convergence, authorization, artifact validation, or persistence. V13 therefore keeps those policies above the client rather than reimplementing PeerJS/WebRTC lifecycle details.

## Public API compatibility

Existing V13 methods remain unchanged:

- `createSession()`
- `joinSession(invitation)`
- `offerArtifact(item, targetPeerId)`
- `capabilitiesFor(nodeId)`
- `capablePeers()`
- `getHealth()`
- `snapshot()`
- `close()`

Additive APIs:

- `probeLatency(targetPeerId?)`
- `setSharedState(value)`
- `getSharedState()`

Presence snapshots now add nullable `latencyMs`. Health adds `stateSyncPeers`.

## Reconnection and synchronization

The transport remains responsible for bounded reconnection and outbound queuing. When PeernetJS reports a transition back to `online`, V13 re-announces presence/capabilities, re-broadcasts the latest shared state, and emits a latency probe. Replay gaps and backpressure still degrade artifact handoff fail-closed.

Shared state is JSON-only and stamped with a Lamport clock plus origin node ID. Higher clocks win; equal clocks use origin ID as a deterministic tie-breaker. This is intentionally a small convergence primitive for shared artifact UI state, not a CRDT or durable project journal.

## Deployment boundary

V13 keeps two different peerjslib relationships explicit.

The **V13 peer runtime** still does not vendor PeernetJS/peerjslib. `loadBrowserPeerStack()` resolves those already-deployed same-origin modules lazily when create/join is requested and otherwise fails closed. Local catalog browsing therefore remains independent from the optional collaboration runtime.

The **Lobby Share reference application** is different: the production build stages the static output from standalone peerjslib v0.4.0 revision `c25450a16c8cf48dc61a20edd04d00eebbb4fb16` under `samples/peerjslib-lobby-share/`. V13 never trusts an existing sibling `dist/`: it verifies that the pinned commit object exists, clones a temporary clean snapshot of that exact commit, reuses only the sibling checkout's installed `node_modules`, runs peerjslib's `sample:build` inside the clean snapshot, and stages those bytes. Dirty tracked/untracked source in the sibling repository therefore cannot taint the pinned payload.

The V13 asset manifest records `sourceMode: clean-git-snapshot`, the exact peerjslib revision, and byte-count/SHA-256 evidence for every staged sample file. Missing dependencies or an unavailable revision fail closed.

Local multi-repo builds resolve `../peerjslib` by default or accept `PEERJSLIB_ROOT`. CI checks out the pinned repository separately and installs its dependencies; the V13 build itself performs the clean-snapshot sample build. This stages a functioning sample without turning V13 into a fork of the library or changing ownership of the PeernetJS runtime adapter.

## Evidence boundary

Deterministic tests use a stubbed peerjslib transport/PeernetJS client surface to verify V13 lifecycle semantics without requiring live WebRTC. A passing static build proves staging/integrity of V13 itself; it does not prove that the separately deployed PeernetJS/peerjslib modules are present, nor does it qualify public PeerServer/TURN or multi-machine Internet behavior. The canonical PeernetJS package test suite is therefore run separately as compatibility evidence.
