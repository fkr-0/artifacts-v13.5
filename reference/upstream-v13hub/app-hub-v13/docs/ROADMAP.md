# V13Hub roadmap

## Now — qualified product baseline

Status: **ready as a self-contained static build; deployment hosting remains an operator choice.**

Implemented:

- modular static ES-module architecture;
- redesigned responsive landing/index/inspector UI;
- validation against the representative `catalog.json`;
- search over artifact/provenance fields, counted topic facets with deterministic any/all matching, kind/availability/evidence/origin facets, and deterministic sorting;
- separate metadata/revision/receipt/live-runtime evidence-ladder stages plus responsive grid/ledger views;
- explicit peer-basis filtering that distinguishes declared `capabilities` from legacy peer-related tags without upgrading the latter into stronger evidence;
- provenance and evidence-level presentation without invented proof;
- peer-aware metadata lens plus an explicit opt-in create/join/leave lobby console;
- lazy reuse of the deployed PeernetJS `PeernetClient` over peerjslib `PeerJsLobby`, with private capability-derived rendezvous and bounded PeerJS policy;
- live presence, lifecycle/health, symmetric capability negotiation, and fail-closed replay-gap/backpressure degradation;
- private game advertisements with bounded capacity, live player counts, lobby chat, host-authorized joins/leaves, and same-room `v13hub.game-handoff/v1` launch context;
- mobile-responsive lobby hosting, directory, chat and join controls;
- per-artifact capability/hash/size/runtime offer-readiness gates plus target capability negotiation;
- `v13hub.peer-offer/v1` descriptor validation and live handoff requiring expiry, SHA-256 and a configured byte ceiling;
- browser-local catalog pinning with missing-pin reconciliation that preserves ids without inventing records;
- user-selected local JSON metadata staged for review before explicit persistence, plus export/removal;
- same-origin launch policy and strict opt-in sandbox preview;
- remote preview denial and explicit confirmation before remote navigation;
- CSP/local-only bootstrap posture;
- deterministic Node tests with no external network dependency;
- pnpm/Biome project checks plus a static build with fingerprinted entry assets, SHA-384 HTML integrity, a hashed asset manifest, and a local preview server.

Known limitations:

- the current checked-in catalog has no receipt-bearing items and no recorded content digest/byte-size fields, so receipt UI and positive peer-transfer readiness are structurally tested only and must not be presented as real catalog evidence;
- the runtime accepts an optional formal `capabilities: string[]` field, but the checked-in catalog does not emit it yet; current peer-aware records are therefore legacy tag signals;
- the peer stack is loaded from already-deployed same-origin PeernetJS/peerjslib module paths only after an explicit create/join action; a standalone deployment without those sibling modules remains fully usable for local catalog/collection work but peer session creation fails closed;
- launched games receive the generic V13 handoff context in their local URL. Arcade-runtime templates can ignore unknown parameters safely, but consuming peer messages/gameplay state remains a game/runtime responsibility rather than hidden hub injection;
- the standalone V13Hub package intentionally keeps its runtime/build dependency-free; canonical Artifact Lab integration owns browser-level qualification for keyboard/focus restoration, local-collection failure truthfulness, responsive density/reflow, reduced motion, and the publication-root user journey.

## Next — provenance and local collection hardening

Proposed acceptance criteria:

1. Have the catalog compiler emit the supported formal `capabilities` field and migrate tag-only peer signals only when upstream evidence justifies the declaration.
2. Add content hashes and signed/structured receipts to generated catalog records; show positive verification only from those fields.
3. Move imported metadata into an IndexedDB-backed collection repository with quota reporting and schema migration while keeping export portable.
4. Add thumbnail/preview descriptors generated locally at build time, with CSP-safe rendering and no opportunistic remote thumbnail fetches.
5. Add collection schema migration/quota tests around future IndexedDB persistence while preserving the current portable export format.

## Then — permissioned peer artifact byte exchange

The live v13 session layer now exchanges only validated, short-lived artifact descriptors. Do not enable byte transfer/persistence until integrity and resource controls exist.

Proposed transfer flow:

```text
peer advertises capability metadata
        │
        ▼
user requests an offer
        │
        ▼
short-lived capability issued
  - random token
  - optional target peer binding
  - expiry
  - declared size
  - cryptographic content hash
        │
        ▼
receiver sees pending transfer
        │
   accept / deny
        │
        ▼
bounded streamed transfer
        │
        ▼
hash verification
        │
        ├── mismatch -> discard + evidence
        │
        └── match -> local object store
                         │
                         ▼
                  metadata indexing
```

Required before launch:

- bounded file size and aggregate quotas;
- cryptographic hash before persistence/indexing;
- retain the current PeernetJS delivery/backpressure/replay-gap mapping without equating `acceptedByHub` with application acknowledgement;
- cancellation plus resumable binary transfer with chunk identity and integrity;
- expiration and replay protection for offers;
- no automatic acceptance or session auto-join;
- no code execution on receipt;
- explicit remote-content provenance in the catalog;
- health UI driven by actual adapter diagnostics;
- adversarial tests for wrong-peer, expired-token, token mismatch, corrupted chunks and disconnect/reconnect cases.

The implemented session/descriptor lane uses modern PeernetJS lifecycle/delivery/recovery semantics over peerjslib and borrows only the capability/expiry/target-binding ideas from legacy experimental file sharing. Binary artifact transfer still needs its own integrity, quota, resume and persistence design before enablement.

## Later — additional product depth

Candidate product growth, ordered behind evidence integrity:

- saved searches and user-defined collections;
- catalog diff/time-travel views;
- source/build/receipt timelines per artifact;
- local full-text index in a worker for much larger catalogs;
- content-addressed local object storage;
- organization/team policy profiles for allowed artifact sources and preview modes;
- optional signed peer identities and collection sharing;
- preview workers for documents/media that never execute artifact application code;
- health feeds from build/deploy systems with explicit freshness timestamps;
- extension/plugin surface based on narrow capability interfaces rather than shared ambient globals.

## Explicit non-goals until evidence exists

- claiming a peer count from tags;
- marking provisional artifacts as verified because they launch;
- fetching remote links to make cards look richer;
- crawling local directories without an explicit permissioned source adapter;
- auto-installing or executing collected artifacts;
- treating a source URL, Git revision, receipt or peer message as interchangeable proof.
