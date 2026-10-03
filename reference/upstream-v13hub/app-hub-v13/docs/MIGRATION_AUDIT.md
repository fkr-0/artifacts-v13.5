# V13Hub legacy migration audit

Date: 2026-09-09

## Scope and method

The four legacy directories are treated as immutable evidence. This audit compared their catalog/document structures and file hashes against the active `app-hub-v13/` slice. No legacy file is a production build input. `tests/migration-audit.test.mjs` locks the quantitative catalog-lineage and duplicate-tree claims below into CI without modifying those references.

## Catalog coverage

| Source | Catalog records | Relationship to V13 |
| --- | ---: | --- |
| `legacy-app-hub/` | pre-v11 portal files | launcher/runtime lineage only |
| `legacy-app-hubs/` | same 23 files as `legacy-app-hub/` | byte-for-byte duplicate reference tree |
| `legacy-app-hub-11/artifacts.source.json` | 49 | every v11 id is present in v12 and therefore represented in v13 |
| `legacy-app-hub-12/v12/catalog.json` | 55 | v13 preserves 54 ids and replaces `app-hub-v12` with `app-hub-v13` |
| `app-hub-v13/catalog.json` | 55 | active catalog |

V12 added six ids beyond v11: `app-hub-v12`, `artifact-handling-standard`, `bathroom-emergency-guide`, `ethic-brawl-source`, `inf-arrange`, and `v12-migration-note`. V13 retains the latter five and replaces the v12 self-record with its own self-record.

Twenty-one shared records differ byte-for-byte between the v12 and v13 catalogs because v13 refreshes Git provenance, source paths/bases, and/or timestamps from the newer catalog generation pass. The catalog summary reflects that refresh: revision-bearing records rise from 44 to 55, legacy-basis records drop from 7 to 0, and dated records rise from 51 to 55. Among the user-facing lifecycle fields, `brickbreaker` is the one material promotion: it changes from `availability=source-only,status=experimental` to `availability=provisional,status=provisional`. That promotion should be reviewed against the upstream catalog compiler before claiming exact historical parity.

## What V13 has absorbed

- V11's data-driven catalog direction plus its useful high-density tag statistics, explicit any/all tag traversal, and grid/list exploration, reimplemented as deterministic V13 metadata controls.
- V12's 55-record release-catalog schema (`schemaVersion`, build metadata, availability, Git provenance, receipt field, launch metadata).
- Local namespaced persistence ideas from the older hub line, redesigned as a versioned collection contract.
- Safer explicit launch behavior while keeping remote content out of automatic previews.
- Catalog metadata for legacy launch capabilities and peer-related tags; these remain metadata rather than runtime proof.
- All catalog ids from v11, plus the five non-hub additions introduced in v12.

## Deliberately not migrated into the V13 runtime

These older capabilities remain reference material rather than V13 dependencies:

- v10/v11 theme, sound, profile, event-log, QR, floating-window, and legacy-tool host implementations;
- v11's ambient Peernet file-transfer/runtime adapter, profile-derived peer posture, and direct peer actions;
- v11 server-side `validate`/`copy`/`index` compiler operation registry;
- v12's required vendored `artifact-bridge` runtime dependency.

V13 is intentionally a self-contained static hub. Reintroducing a capability requires an explicit V13 contract and tests rather than copying a legacy runtime wholesale.

## Remaining migration/product gaps

1. **Launch-mode fidelity:** v11/v12 catalog records can describe inline/floating/fullscreen/new-window actions, while V13 currently normalizes execution to its stricter local/remote launch and preview policy. Metadata is preserved, but UI behavior is not full v11 launcher parity.
2. **Catalog compiler ownership:** this repository consumes the checked-in v13 catalog; it does not yet rebuild it from v11 source catalogs or an upstream artifact registry. Version collisions now fail closed in the runtime contract, but upstream generation remains separate.
3. **Receipt verification:** v12 carries a positive artifact receipt for its own assembled release. The checked-in v13 catalog has no receipt-bearing items, so V13 reports receipt presence but does not invent verification.
4. **Provenance refresh and BrickBreaker state drift:** 21 shared records carry refreshed provenance/timestamps in v13; separately, BrickBreaker is promoted from source-only/experimental to provisional/provisional. The provenance refresh is newer evidence, while the lifecycle promotion needs upstream justification if exact historical parity is required.
5. **Legacy utility parity:** themes, sounds, profiles, QR, floating panels, and legacy utility hosts are not product requirements for the static v13 hub today; they are candidates only if a concrete user workflow justifies them.

## Consolidation decision

The active product boundary is `app-hub-v13/` plus its own tests/build tooling. Legacy directories remain read-only evidence and are excluded from lint, test, and build inputs. The duplicate generic legacy trees are documented but intentionally not deleted under the preservation constraint.
