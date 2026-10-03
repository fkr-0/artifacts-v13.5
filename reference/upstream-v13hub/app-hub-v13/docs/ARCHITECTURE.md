# V13Hub architecture

## Intent

V13Hub is a local-first artifact index and launch surface. The product boundary deliberately separates **what metadata says**, **what the current runtime can prove**, and **what the user has explicitly chosen to collect**.

It remains a static ES-module application because the current V13 artifact is an offline directory release. Catalog/collection behavior has no peer dependency. The peer console is an explicit, lazy integration point: only a create/join action attempts to load the already-deployed PeernetJS client plus peerjslib PeerJS lobby, and an unavailable peer stack fails closed without affecting local browsing.

## Information flow

```text
checked-in/generated catalog.json
          │
          ▼
   lib/catalog.js ───────► normalized artifact records
          │                         │
          │                         ├── search / facets / sort
          │                         ├── provenance + health view
          │                         └── peer-capability signals from metadata
          │
          └────► lib/discovery.js ─► counted topic facets + separate evidence ladder
          │
local JSON selected by user
          │
          ▼
 lib/state.js staged import ──► explicit review / accept
          │
          ▼
 lib/collection.js ──────► browser-local collection state
          │                         │
          │                         ├── pinned catalog ids
          │                         └── explicitly imported metadata
          │
          └─────────────────────────┐
                                    ▼
                             app.js renderer
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
          lib/policy.js                       lib/state.js
      launch / preview policy             pure interaction reducer
                  │
                  ▼
       local target: explicit action
       remote target: preview blocked,
                      launch confirmation required

explicit create/join ─► lib/peer.js ─► PeernetJS PeernetClient
                               │              │
                               │              └► peerjslib PeerJsLobby / PeerJS
                               ├── private capability-derived rendezvous
                               ├── bounded presence + capability negotiation
                               ├── bounded lobby chat + game advertisements
                               ├── host-authorized game membership + same-room handoff
                               ├── explicit health/recovery => runtime proof
                               └── validated short-lived artifact offer descriptor

no user action / missing modules / degraded recovery => no handoff proof
```

## Runtime modules

| Module | Responsibility | Explicit non-responsibility |
| --- | --- | --- |
| `lib/catalog.js` | Validate catalog shape, normalize display records, distinguish declared capabilities from legacy tag signals, derive provenance/health, search/filter/sort including explicit topic matching | Does not verify Git revisions, receipts, URLs or network state |
| `lib/discovery.js` | Count recorded topic facets deterministically and expose metadata/revision/receipt/runtime proof as separate evidence-ladder stages | Does not infer popularity, trust, capabilities, verification, or network health |
| `lib/collection.js` | Store catalog pins and explicitly accepted local metadata; reconcile missing pins without fabricating records | Does not scan the filesystem, fetch URLs, download artifact content or execute imported data |
| `lib/policy.js` | Classify launch targets, deny unsafe schemes and block remote previews | Does not create peers, probe remote URLs or infer connectivity |
| `lib/peer.js` | Lazily load the existing PeernetJS + peerjslib stack after explicit create/join; derive private sessions; bound presence, lobby chat, game advertisements/membership, queues and offers; negotiate capabilities; normalize health/recovery; gate game handoff and short-lived artifact descriptors | Does not auto-connect, duplicate PeerJS transport logic, transfer/persist artifact bytes, authenticate player ids, treat hub acceptance as application acknowledgement, or fill missing telemetry with invented proof |
| `lib/state.js` | Pure reducer for lenses, search/facets, topic any/all state, grid/ledger view, selection/preview intent and staged local-import intent | Does not persist or perform I/O |
| `app.js` | Orchestrate catalog loading, render DOM, wire explicit local actions, and expose create/join/leave + artifact-offer controls | Does not own catalog generation, verification, PeerJS transport internals, or remote-byte persistence |

The runtime loads only its colocated `./catalog.json`. The request target and the browser-reported final response URL must both remain same-origin and inside the current deployment base; cross-origin redirects, base escapes, credential-bearing targets and unsupported protocols fail closed. Build-time route reconciliation may rewrite the launch URL to a staged output path or null it when absent, but it never upgrades or downgrades recorded release availability from route existence alone; deployment state remains a separate axis. Legacy/upstream registry paths are migration inputs, not runtime fallbacks, so a deployed static artifact cannot silently bind itself to a different catalog higher in the hosting tree.

## Artifact contract

The existing catalog remains authoritative. V13Hub requires only:

```text
artifact:
  id: non-empty string
  title: non-empty string
  url: optional string|null
  tags: optional string[]
  capabilities: optional string[]
  everything_else: preserved and displayed only when understood
```

Duplicate ids in the generated catalog are rejected. Local imports also reject duplicate ids within one selected file. Unknown metadata is preserved for a local import rather than rewritten into invented fields.

Derived fields are deliberately labeled as derived UI state:

- `recordOrigin`: catalog or explicit local import.
- `capabilityProfile`: distinguishes explicit peer capabilities from legacy peer-related tags.
- `peerSignals`: explicit peer capabilities when supplied plus legacy signals such as `peernet`, `p2p`, `multiplayer` or `collaborative`.
- `peerAware`: **declared capability or legacy signal metadata only**, never an online claim. The UI exposes which basis was used.
- `health`: a presentation of recorded availability plus the evidence actually present. A recorded `verified` value is exposed as unknown unless receipt evidence explicitly supports verification. Its `evidenceAxes` keep source ownership, validation, release-receipt support, and runtime/network proof independent; absent scoped evidence remains `unknown` rather than inheriting a green state from status, URL existence, or another axis.
- `provenance`: a view over recorded source kind, Git basis/revision/path, changed time and receipt presence.

A receipt is shown as present only when the catalog record actually contains one.

## Collection contract

Persistent key: `v13hub:collection:v1`.

```text
schemaVersion: v13hub.collection/v1
pinnedIds:
  - catalog artifact ids only
imports:
  - recordKey: internal collection identity
    sourceName: filename supplied by the browser file picker
    importedAt: local import time
    artifact: exact JSON metadata selected by the user
```

Saving a generated catalog artifact stores only its id; V13Hub continues to read its metadata from the catalog rather than making a second stale copy. If that id later disappears, reconciliation reports the unavailable reference and does not synthesize artifact metadata. Local JSON import occurs only through an explicit file-picker action, is limited to 500 artifact records per file, is staged in volatile UI state for review, and reaches persistent collection state only after a second explicit acceptance action. The file is never uploaded.

## Preview and remote-content boundary

The default policy is fail closed:

```text
no URL                  -> no launch, no preview
javascript:/data:/etc.  -> blocked
same-origin HTTP(S)     -> explicit launch; optional strict sandbox preview
remote HTTP(S)          -> no preview; explicit confirmation before new-window navigation
```

Strict previews are created only after a click and use an empty iframe sandbox plus `referrerPolicy=no-referrer`. Scripts, forms, popups, same-origin privileges and storage access are therefore withheld from previewed content. The page CSP further restricts bootstrap, fetch and frame content to same-origin resources.

## PeernetJS ideas adopted

The canonical project at `/home/user/work/code/artifacts/peernetjs` and the standalone `/home/user/code/peerjslib` v0.4.0 transport were inspected read-only. V13Hub keeps their authority split: PeernetJS owns bounded application envelopes/logical routing and peerjslib owns the actual PeerJS/WebRTC lobby, replay, reconnect, heartbeat and admission machinery. V13Hub does **not** copy either transport implementation; it loads deployed same-origin modules lazily after explicit user action.

1. **Protocol and transport are different authorities.** PeernetJS keeps application envelopes/logical routing above the lobby transport. V13Hub likewise keeps artifact metadata, collection policy and future transport adapters separate.
2. **Lifecycle truth is explicit.** PeernetJS models `idle → connecting → online`, with reconnecting/offline and final closed states, plus a structured health snapshot. `lib/peer.js` therefore accepts proof only when an adapter explicitly reports `connected: true`; a string state such as `online` alone is insufficient.
3. **A transport receipt is not application convergence.** PeernetJS `acceptedByHub` means hub acceptance only. A future V13 adapter must never turn that receipt into “artifact collected”, “verified”, permission, or end-to-end acknowledgement.
4. **Recovery is visible.** Modern PeernetJS surfaces queued/submitted/hub-accepted delivery, replay gaps and backpressure rather than silently filling history. V13 now passes through adapter-supplied queue/pending/reconnect/backpressure/role/epoch/error diagnostics and renders missing fields as unreported; a future transfer adapter should extend that boundary for replay gaps without inventing messages.
5. **No implicit persistence or authentication.** Modern PeernetJS treats peer ids, logical node ids, room names, timestamps and message ids as untrusted routing data and deliberately has no stable implicit persistence API. V13 keeps collection persistence in its own versioned local contract.
6. **Capability-grade transfer remains a separate concern.** The legacy experimental `peernet-file-share.js` demonstrates useful expiry, optional target binding, explicit deny/cancel and opaque capability tokens, but it does not establish production integrity. V13 uses those ideas only in the offer boundary and adds mandatory SHA-256, declared size, caller-supplied byte ceilings and post-transfer verification requirements.

The static application has no network side effects during bootstrap or ordinary catalog use. A create/join click may start the existing peer stack. Peer-tagged catalog records remain discovery metadata only; an artifact offer additionally requires healthy live-session proof, hash, bounded size, and a target that negotiated `artifact-offer-v1`. A replay gap or backpressure signal leaves the session observable but blocks handoff until a fresh session is established.

## Live peer integration boundary

The installed session runtime is intentionally narrow enough that the UI cannot silently widen network authority:

```text
PeerSessionRuntime
  createSession() | joinSession(invitation) | close()
  getHealth() -> PeernetJS/peerjslib-derived proof + degradation
  participants + negotiated capabilities
  sendChat(text)
  hostGame(...) | joinGame(...) | leaveGame(...)
    -> v13hub.game-handoff/v1 using the existing transport session
  offerArtifact(item, targetPeerId)
    -> v13hub.peer-offer/v1 descriptor
    -> PeernetJS logical send
    -> peerjslib hub-acceptance receipt

  delivery/recovery events -> replay-gap | backpressure => handoff blocked

Future byte-transfer layer (not implemented):
  explicit accept / deny
  bounded chunks / resume
  post-transfer SHA-256
  quota-aware local object persistence
```

Current invariants for the session/descriptor layer:

- No ambient remote discovery causes a download.
- Every transfer has a bounded size and declared cryptographic content hash.
- Capability expiry and optional target-peer binding are checked before transfer.
- No artifact bytes are transferred by this layer; a later transfer implementation must require user acceptance before persistence and post-transfer SHA-256 before indexing/preview.
- No artifact code is executed as part of peer handoff.
- Health/peer counts come from adapter evidence, never tags or UI optimism.
- Received artifact offers are capability-gated and expiry/size/hash validated, including a configured maximum offer lifetime. Sender + offer-id replay evidence is retained until offer expiry; if the bounded replay tracker is full, new live offers fail closed rather than evicting still-valid replay evidence. Offers remain volatile review metadata and never become catalog or collection authority.

## State model

`lib/state.js` keeps volatile interaction state separate from collection persistence:

```text
lens: discover | collection | peer
query: string
kind: string | empty
availability: string | empty
evidence: receipt-present | revision-only | metadata-only | empty
origin: catalog | import | empty
selectedTags: string[]
tagMode: any | all
sort: recent | evidence | title | health
view: grid | list
selectedKey: artifact record key | null
previewKey: explicitly previewed record key | null
pendingImport: validated local metadata set | null
```

This separation is intentional: a URL/filter can later be made shareable without granting collection or peer permissions.

## Testing boundary

`pnpm check` is the repository gate: Biome checks the application/runtime/test/build JavaScript, Node's built-in test runner exercises contracts and edge cases, and the static build verifies the deployable output. Tests cover the real checked-in catalog contract, empty and malformed catalogs, deterministic topic any/all filtering and counted facets, separated evidence-ladder semantics, evidence/origin filtering, grid/ledger reducer state, version collisions, local collection/import lifecycle, missing-pin reconciliation, staged-import transitions, corrupt-state fallback, conflicting policy rules, blocked URL schemes, remote-preview denial, PeernetJS-shaped health/recovery fail-closed behavior, deterministic create/join/presence/capability negotiation, lobby chat/game discovery/player-count/same-room game handoff, degraded-transport handoff blocking, artifact offer-readiness gates, bounded/expiring peer-offer validation, accessible static discovery landmarks, SHA-384 entry-asset integrity, manifest evidence, post-build tamper detection, and preview-server traversal rejection. No external network is needed to pass the suite; these tests are structural/local evidence and do not prove browser-to-browser or multi-peer operation.
