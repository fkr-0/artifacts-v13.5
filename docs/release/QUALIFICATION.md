# V13.5 Release Qualification

## Current gate

A release candidate is qualified only when all of these hold:

- the V12 parity baseline contains 44 expected local routes;
- strict assembly stages 44/44 expected local routes with zero missing;
- Meme Lab is staged at /meme-lab/meme-lab.html;
- the launcher is staged at the release root and covered by the asset manifest;
- the complete release passes model/unit/integration tests;
- a real Chromium session renders the catalog, searches to Meme Lab, follows its Open route, and observes no hub runtime exception.

## Canonical portfolio input

The current source authority is the Artifact Lab repository:

- repository: fkr-0/artifact-lab-pages
- qualification pin: 97c026b77e6dc26ed00e93a74e36d1540be84db1
- local development default: ~/work/code/artifacts
- override: ARTIFACTS_SOURCE_ROOT

The pin is intentional. Updating the source revision is a reviewed release change, not ambient CI drift.

If artifact-lab-pages is private, CI requires an ARTIFACT_SOURCE_TOKEN secret with read access. The default repository token may be sufficient only when GitHub grants access to that repository.

## Compatibility routes

Sixteen expected V12 routes are supplied by the explicit V11 compatibility bundle under catalog/compat-runtime. They are not reported as canonical-source routes. The parity report records sourceKind=v11-compat for them.

This compatibility layer currently covers the old legacy-tools host, V9/V10 portals, collaborative editor pages, and Markdown viewer host/documents. Future replacement by native V13.5 equivalents must preserve the public route contract or add a reviewed migration/tombstone.

## Browser smoke

tests/qualification/browser-smoke.mjs uses Chromium's DevTools Protocol directly and has no application dependency on Playwright or Puppeteer. It verifies:

1. the hub renders at least the restored expected portfolio;
2. searching for "meme lab" leaves the Meme Lab card;
3. the primary Open link resolves to the expected same-origin route;
4. the hub reports no runtime exception/error before navigation;
5. browser navigation reaches /meme-lab/meme-lab.html.

Locally it uses CHROMIUM_BIN when set, otherwise chromium/chromium-browser/google-chrome from PATH. CI uses Playwright only to install a pinned Chromium binary.
