# V13.5 hub dashboard and provenance

## Dashboard

The hub header shows the number of visible / total artifacts, verified entries,
the count and composition of artifact kinds, release build time, hub Git revision,
commit count, and last recorded publication. Cards default to descending
`git.changedAt` / `changedAt` / `updatedAt` order. Undated items sort last.
This is the timestamp of the **catalogued** artifact revision; it does not
assert that an uncommitted local working tree was published.

The settings menu offers five themes (lime, cobalt, amber, monochrome, paper),
comfortable/compact density and automatic/wide cards. Preferences and sorting
are saved only in browser `localStorage`, and recover gracefully when storage is blocked.
They do not affect favorite lists or launch URLs.

## Build versus deployment

`catalog.generatedAt` is the **build timestamp**. It is not a deployment date.
`catalog.hub.revision` is the current V13.5 repo Git HEAD at build time.
`catalog.hub.commitCount` counts the commits reachable from that HEAD.
`catalog.hub.dirty` marks when tracked hub code differs from HEAD, in which
case the short revision is marked with `*`.

A release publisher may record an authoritative deployment receipt at
`catalog/deployment.json` **before** constructing the published catalog:

    {
      "schemaVersion": "artifacts-v13.5/deployment-v1",
      "deployedAt": "2026-10-21T18:30:00Z",
      "revision": "0123456789abcdef0123456789abcdef01234567"
    }

The above is a *format example*, not a deployment claim. Both the actual
publication timestamp and the **40-character published Git revision** must
come from the publishing process. The build validates this input and exposes
it as `catalog.release.lastDeployedAt` / `deployedRevision`, with provenance
`publication-receipt`. When no receipt exists, the UI says **Not recorded**.

Do not prefill the receipt from `git log`, local build time, or a guessed
GitHub Pages timestamp. The deployment workflow and its GitHub-side verification
remain the authority for publication.

## Build / release safety

- `npm test` checks sorting, page controls and metadata fallback.
- `npm run build` assembles the hub plus canonical source from
  `ARTIFACTS_SOURCE_ROOT` or `~/code/artifacts`.
- `npm run release:check` performs strict release parity checks.
- `npm run publication:handoff` requires a clean tracked tree and validates
  a canonical source revision; it does not publish automatically.

**Do not upload the local `dist/` to production just because the build passes.**
Compare the publication inventory first: the 2026-10-21 local build assembled
60 items while the owner's screenshot of the live site showed 63.
