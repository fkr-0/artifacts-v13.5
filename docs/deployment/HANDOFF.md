# V13.5 publication handoff

## Deployment authority

V13.5 does not create a second Pages owner.

The existing deployment authority is:

- repository: fkr-0/artifact-lab-pages
- workflow: .github/workflows/pages.yml
- site: artifacts.fkr.dev
- provider: GitHub Pages

The canonical Artifact Lab working tree was heavily dirty during V13.5 recovery, including its Pages workflow and publication scripts. V13.5 therefore does not mutate that repository in this lane.

## Produce a qualified handoff

From a clean V13.5 checkout with the canonical Artifact Lab source available at the pinned revision:

    ARTIFACTS_SOURCE_ROOT=/path/to/artifact-lab-pages npm run publication:handoff

The command:

1. refuses tracked dirty V13.5 state;
2. runs strict release assembly;
3. verifies 44/44 V12 expected-local parity;
4. verifies the 56-item current-native superset;
5. requires the V13.5 root launcher, Meme Lab, and pinned Revealive release to be SHA-256 covered;
6. writes dist/PUBLICATION_HANDOFF.json;
7. does not perform network publication.

Generated dist remains ignored source output.

## Existing Pages integration seam

When the canonical Artifact Lab repo is reconciled and clean, its Pages workflow should remain the single deployment owner. A narrow integration can replace its publication-stage producer with the qualified V13.5 stage, or check out a pinned V13.5 repository and run publication:handoff using the Artifact Lab checkout as ARTIFACTS_SOURCE_ROOT.

Do not merge this by overwriting an actively dirty .github/workflows/pages.yml or scripts/build-publication-site.mjs. Reconcile that repository first, then review the exact stage switch.

The Pages upload step should consume the complete V13.5 dist directory only after PUBLICATION_HANDOFF.json matches:

- the intended V13.5 Git commit;
- canonical source repository fkr-0/artifact-lab-pages;
- source revision 6e6480e0295ae2ca7a05ee11e641ed2b518aa4f6;
- stagedV12Local = 44;
- missingV12Local = 0;
- catalogItems = 56;
- currentNativeAdded includes revealive.

A future remote/push for this new V13.5 repository must be explicitly established before the canonical workflow can pin and check it out by repository identity.
