# V13Hub product direction

## Product thesis

Artifact collections become useful when a user can answer five questions quickly:

1. **What is this?** — title, kind, description and tags.
2. **Where did it come from?** — source kind, path, Git basis/revision and changed time when recorded.
3. **How healthy is it?** — recorded availability and the evidence actually present, without upgrading “provisional” into “verified”.
4. **Can I inspect it safely?** — metadata first; same-origin preview only on request; remote preview denied.
5. **Do I want to keep it?** — browser-local pinning or explicit local metadata import.

V13Hub is therefore designed as an **artifact commons**, not a decorative launcher grid.

## Information architecture

```text
V13Hub
├── Landing / trust posture
│   ├── current catalog counts
│   ├── revision / receipt evidence
│   ├── explicit evidence ladder
│   ├── local collection state
│   ├── peer proof state
│   └── adapter-only recovery diagnostics when supplied
├── Discover
│   ├── full-text search
│   ├── counted topic facets with explicit any/all matching
│   ├── kind + health/availability facets
│   ├── evidence + origin + peer-basis facets
│   ├── grid or ledger presentation
│   └── sort by recency, evidence strength, title or health
├── Collection
│   ├── pinned catalog references
│   ├── staged local JSON review before persistence
│   ├── unavailable-pin reconciliation
│   ├── export
│   └── clear/remove
├── Peer-aware
│   └── records whose existing metadata signals peer/P2P/collaborative capability
└── Object inspector
    ├── description and tags
    ├── health / evidence level
    ├── provenance fields
    ├── peer-collection evidence gates
    ├── receipt presence
    ├── safe launch policy
    └── explicit strict local preview
```

## Visual language

The redesign uses an editorial-instrument language rather than a generic dashboard:

- near-black paper with a faint technical grid;
- warm off-white type, acid green for local/trusted interaction, blue for peer-capability metadata, amber for provisional state;
- large serif/sans contrast in the landing statement, compact monospace for evidence and runtime state;
- square, line-driven components instead of uniform rounded cards;
- a compact evidence ladder and tag-frequency traversal deck ahead of the detailed filter surface;
- interchangeable spatial grid and denser ledger views over the same reducer-owned state;
- dense enough for artifact work but with a strong landing hierarchy;
- responsive breakpoints that move the inspector inline and reduce the catalog from three columns to one;
- visible keyboard focus, semantic landmarks, a skip link, live result status and reduced-motion handling.

No external font, image, analytics or CDN request is required.

## Health semantics

V13Hub does not invent a numeric trust score. It exposes two related facts:

- `availability`: the state recorded by the artifact catalog (`verified`, `provisional`, `source-only`, `external`, `inline`, or unknown values). A recorded `verified` value is not presented as verified health unless explicit receipt evidence supports that claim.
- `evidenceLevel`: derived solely from what metadata exists (`receipt-present`, `revision-only`, or `metadata-only`).

These are intentionally not collapsed into a single badge that could imply more certainty than the catalog contains.

Publication route state is separate again: a staged file can be deployable without becoming a verified release, and an unstaged route can be non-launchable without rewriting its recorded release-health metadata.

## Peer-aware semantics

The peer lens means **“metadata says this artifact is associated with peer/P2P/collaborative behavior.”** V13Hub now preserves two distinct sources for that statement: an explicit `capabilities: string[]` declaration when one actually exists, or a clearly labeled legacy peer-related tag signal. A legacy tag is never rewritten into a declared capability. It does not mean:

- a peer is online;
- the artifact is reachable;
- a remote copy has been verified;
- a transfer is safe;
- PeernetJS is connected.

A live peer indicator is allowed only when a transport adapter supplies explicit `connected: true` health evidence. A state label such as `online` alone does not qualify. Recovery diagnostics are treated with the same discipline: queue depth, pending sends, reconnect attempts, backpressure signals, role/epoch and last error are shown only when the adapter actually reports them; missing values remain unreported rather than being rewritten as zero. The current product loads its same-origin PeernetJS/peerjslib adapter only after an explicit create/join action; before that action, or when those sibling modules are unavailable, it truthfully reports no peer proof or recovery telemetry.

For each artifact, the inspector separately evaluates whether a future peer offer could even be requested. All four gates must pass: peer-capability metadata, a recorded SHA-256 content digest, a declared byte size, and live adapter evidence. Passing those gates would mean **eligible to create/request an offer**, not delivered, accepted, verified or converged. This mirrors PeernetJS's important distinction between transport acceptance and application-level truth.

The game-lobby surface is a separate opt-in application protocol above that same live session. A participant may advertise a locally launchable catalog game with a bounded seat count; peers see the advertised sessions and current player membership, can exchange bounded chat, and can request to join. The host is authoritative for membership. Acceptance does not create another PeerJS room: V13Hub emits a `v13hub.game-handoff/v1` context carrying the already-established transport session id, game-session id, host and local node id into the local launch URL. The handoff is routing context, not player authentication or game-state verification.

## Collection semantics

### Pinning

Pinning a catalog artifact records its id in browser-local state. Metadata stays authoritative in `catalog.json`.

### Local import

“Select local JSON” opens the browser file picker. The selected JSON must contain one artifact object, an array, or an object with `items`. Each item must have `id` and `title`. V13Hub first stages the validated set only in volatile UI state, shows the actual selected filename and real artifact ids/titles, and persists nothing until the user chooses **Add metadata to collection**. Escape or **Discard staged import** drops the staged set.

Import is **not** filesystem crawling, network upload, remote fetch or artifact execution. The review step is a permission boundary, not a claim that the metadata itself is trusted.

### Export

Export serializes the local collection contract into a JSON download. This creates a user-controlled escape hatch before richer storage is introduced.

## Current checked-in evidence

The checked-in representative catalog used by the implementation contains 55 records. Its recorded availability distribution is 45 provisional, 8 source-only, 1 inline and 1 external. Ten records currently carry peer/P2P/collaborative signal tags, and the current catalog contains no `capabilities` field, so those ten remain explicitly labeled legacy signals rather than declared peer capabilities. No catalog item currently carries a receipt, so the UI must show zero receipt-backed records rather than imply verification.

These counts are a snapshot of the checked-in catalog and are computed by the application/tests rather than embedded as product promises.

## PeernetJS product principles carried forward

V13Hub uses the current canonical PeernetJS project as architectural input without claiming network qualification:

- application protocol, transport and persistence remain separate product surfaces;
- peer identity/routing fields are untrusted inputs, not authentication;
- lifecycle, reconnect, replay-gap and backpressure states must be visible instead of collapsed into a generic “online” badge; V13 already has a narrow adapter-only surface for queue/pending/reconnect/backpressure diagnostics;
- transport hub acceptance must never render as artifact verification or collection success;
- a future transfer needs an explicit capability, expiry, byte ceiling, content digest, user acceptance and post-transfer verification;
- no network activity is enabled merely because an artifact carries a `peer`/`p2p` tag.

## Product boundaries

V13Hub can continue to grow without discarding its evidence-first/local-first model if these boundaries remain stable:

- **Catalog compiler** owns source ingestion and metadata validation.
- **Hub UI** owns discovery and user intent.
- **Collection service** owns durable local objects and quotas.
- **Preview broker** owns isolation policies and generated previews.
- **Peer adapter** owns transport, capabilities and network health.
- **Verification service** owns hashes, receipts and provenance proof.

No layer should silently upgrade metadata into proof owned by another layer.
