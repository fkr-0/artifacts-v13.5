# V13.5 Architecture

## Goal

Produce a fresh artifacts.fkr.dev that behaves like a sanitized V12 hub while preserving the useful safety and evidence work from V13.

## Architectural inversion

V13 narrowed the production payload to the hub runtime plus selected integrations and then reconciled absent catalog targets into unavailable routes.

V13.5 restores the portfolio as the build product:

    canonical catalog / source registry
                |
                v
        portfolio assembler
                |
                +--> stage every expected local artifact
                +--> build/copy artifact-owned outputs
                +--> preserve stable public routes
                +--> hash staged files
                +--> emit route + parity evidence
                |
                v
          verified release tree
                |
                v
         lightweight hub UI

The UI consumes the verified release catalog. It does not decide whether a missing artifact should silently disappear.

## Release invariants

1. Every historically deployable local V12 artifact must resolve to one of:
   - staged and launchable;
   - explicit source-only/external classification;
   - explicit reviewed tombstone.
2. Missing expected local payloads fail the build.
3. Meme Lab is a named regression fixture and must resolve to its staged route.
4. Every launchable same-origin route must exist in the release tree.
5. Route verification, hashes and provenance are evidence; they do not replace payload assembly.
6. Reference snapshots are immutable migration evidence and never production inputs by accident.

## Product UX

Primary workflow:

    open hub -> browse/search/filter -> inspect optionally -> Open

Secondary workflow:

    Favorite -> local-only preference state

The old V13 collection/import model may survive only as an optional advanced/local-metadata feature. The term "Collection" must not imply a prerequisite for artifact availability.

## Ownership boundaries

    scripts/ + catalog/
      release assembler, source resolution, parity, manifests

    src/ui/ + src/lib/
      discovery, filtering, launch UX, Favorites, provenance details

    tests/qualification/ + .github/ + docs/release/
      V12 parity gate, browser E2E, CI/release qualification

    reference/
      immutable migration evidence

## Initial migration evidence

The imported upstream snapshot contains:

- V12 launcher HTML/JS/CSS/catalog;
- V13 launcher HTML/JS/CSS/catalog;
- V13 catalog/collection/discovery/navigation/policy/peer/routes/state libraries;
- V13 architecture/product/migration documentation;
- V13 static build implementation.

This provides enough evidence to reimplement intentionally instead of copying V13's narrowed release boundary wholesale.
