# App Hub v11 Roadmap

v11 moves the hub from a hand-written single file toward a small modular shell. The first implementation keeps the useful v10 behavior while moving policy and options out of the HTML runtime.

## Implemented slice

- Server-maintained artifact source list: `app-hub-v11/artifacts.source.json`.
- Compiler: `app-hub-v11/server/artifact-catalog.mjs`.
- Clean generated list: `app-hub-v11/data/artifact-collection.json`.
- Extensible operations: `validate`, `copy`, `index`.
- Browser libs:
  - `lib/menu.js` for grouped menu and autocomplete-style filtering.
  - `lib/launcher.js` for inline, floating, tabbed, fullscreen, and new-window mode normalization.
  - `lib/themes.js` for the theme registry.
  - `lib/storage.js` for namespaced local storage.
  - `lib/sound.js` for optional sound effects.
  - `lib/network.js` for a replaceable networking adapter boundary with targeted peer sends.
  - `lib/qr.js` for QR display of file-share links with a visible copy-link fallback.
- Peernet file sharing:
  - `../peernetjs/peernet-file-share.js` keeps selected files local/in-memory.
  - Online-user context menu can create short-lived direct file offers.
  - Share links bootstrap a small download panel via URL parameters.
  - Incoming offers support explicit download/deny flow before chunks are streamed.

## Next implementation tasks

1. Replace the simple floating pane with the existing root `lib/ui/floating-panels.js` manager when v11 needs multi-window docking parity with v10-enhanced.
2. Add a `bundle` operation that copies a directory and rewrites relative entrypoint URLs.
3. Add a `shellCommand` operation for generated artifacts that must compile before indexing.
4. Convert root `artifacts-package` and `artifacts-deploy` include lists to consume `artifact-collection.json` instead of duplicated bash arrays.
5. Add a headless browser smoke test once the environment has a reliable browser runner.
6. Harden file sharing for larger files: backpressure, cancellation, checksums, and resumable offsets.
7. Move the QR helper to a fully vendored/offline encoder if CDN loading is not acceptable for release packaging.

## Non-goals retained from v10

- Do not turn the hub into a CRDT editor.
- Do not absorb PeerModGroove internals into the portal.
- Do not add raw PeerJS setup to app-hub runtime code.
