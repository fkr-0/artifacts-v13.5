# V13.5 publication handoff

## Deployment authority

V13.5 does not create a second Pages owner.

The existing deployment authority is:

- repository: fkr-0/artifact-lab-pages
- workflow: .github/workflows/pages.yml
- site: artifacts.fkr.dev
- provider: GitHub Pages

Artifact Lab owns the deployment workflow; V13.5 remains a non-publishing release
producer. The settlement keeps those responsibilities separate even though the
two repositories now participate in one pinned publication chain.

## Produce a qualified handoff

From a clean V13.5 checkout with the canonical Artifact Lab source available at the pinned revision:

    ARTIFACTS_SOURCE_ROOT=/path/to/artifact-lab-pages npm run publication:handoff

The command:

1. refuses tracked dirty V13.5 state;
2. resolves the actual Artifact Lab source checkout revision and requires the
   canonical pin to be that revision or an ancestor of it;
3. records both the qualification pin and actual source checkout revision in
   the handoff;
4. runs strict release assembly;
5. verifies 44/44 V12 expected-local parity;
6. verifies at least the 55-item current-native catalog floor;
7. requires the V13.5 root launcher, Meme Lab, and pinned Revealive release to be SHA-256 covered;
8. writes dist/PUBLICATION_HANDOFF.json;
9. does not perform network publication.

Generated dist remains ignored source output.

## Pages integration

Artifact Lab's Pages workflow remains the single deployment owner. It checks
out a pinned V13.5 revision, runs publication:handoff with the Artifact Lab
checkout as ARTIFACTS_SOURCE_ROOT, materializes the qualified V13.5 stage, then
verifies its integration receipt before upload.

The verified V13.5 directory is the terminal Pages upload input. Do not rebuild
or selectively rewrite the stage after receipt verification; any composition
change requires a newly generated handoff and receipt.

The Pages upload step should consume the complete V13.5 dist directory only after PUBLICATION_HANDOFF.json matches:

- the intended V13.5 Git commit;
- canonical source repository fkr-0/artifact-lab-pages;
- source revision 6e6480e0295ae2ca7a05ee11e641ed2b518aa4f6;
- actual source checkout revision matching the Artifact Lab checkout consumed by the adapter;
- stagedV12Local = 44;
- missingV12Local = 0;
- catalogItems >= 55;
- currentNativeAdded includes revealive.
