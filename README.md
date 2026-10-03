# Artifacts Hub V13.5

V13.5 is the recovery/convergence release for artifacts.fkr.dev.

Its product boundary is deliberately simpler than V13:

- start from the V12 launcher model: browse, search, filter, open;
- restore the complete local artifact release payload instead of shipping only the hub shell;
- retain V13 provenance, integrity, route-safety, accessibility and peer metadata as supporting evidence;
- treat Favorites/local metadata as optional user state, never as a prerequisite for launching artifacts;
- fail the release when a previously deployable local artifact disappears without an explicit tombstone.

## Status

This repository is a new clean convergence project. The previous `v13hub` repository remains unchanged and is imported only as migration evidence under `reference/upstream-v13hub/`.

The first three governed implementation lanes are:

1. full portfolio assembler and V12 parity;
2. sanitized V12-derived launcher UX;
3. independent parity/E2E/release qualification.

## Reference evidence

`reference/upstream-v13hub/legacy-app-hub-12/v12/` contains the V12 launcher/catalog snapshot.

`reference/upstream-v13hub/app-hub-v13/` and `reference/upstream-v13hub/scripts/build-lib.mjs` contain the V13 runtime and release-hardening snapshot.

Reference content is read-only migration evidence and must not become an implicit runtime dependency.

## Target release shape

    dist/
    ├── index.html
    ├── catalog.json
    ├── asset-manifest.json
    ├── route-manifest.json
    ├── parity-report.json
    ├── meme-lab/
    │   └── meme-lab.html
    ├── brickbreaker/
    │   └── index.html
    ├── markdown-viewer/
    │   └── ...
    └── ...

A local catalog item is launchable only when its staged route exists and passes release verification. A missing expected local artifact is a build failure, not a successful `unavailable` downgrade.

See `docs/ARCHITECTURE.md` for the convergence contract.
