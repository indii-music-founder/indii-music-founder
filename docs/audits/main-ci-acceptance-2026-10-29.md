# Exact-main CI evidence — 2026-10-29

Decision: CI-V3-20261019-01's stated CI gate is VERIFIED. No numbered issue or complete rights release is closed.

## Authoritative revision and runs

Current `origin/main` at inspection: `3d33f0162d05e53c9aca2fef06fe4f40868e5d68`, containing the seven owner-merged PRs #549–#555. Git fetch and GitHub run metadata agree on the revision.

- [Deploy to Firebase Hosting — 40907983651](https://github.com/indii-music-founder/indii-music-founder/actions/runs/40907983651): completed, success, exact head SHA above.
- [Docs and Policy Gate — 40907983509](https://github.com/indii-music-founder/indii-music-founder/actions/runs/40907983509): completed, success, same head SHA.

GitHub’s commit check-runs endpoint listed **27 completed successful checks** for this SHA. The legacy status endpoint had no status contexts (its aggregate label was `pending` with an empty list); this was not treated as a pending job or as green evidence. The 27 concrete check runs and workflow logs provide the evidence.

The deployment workflow's setup, rules tests, all 20 unit-test shards, build, staging deployment, staging smoke and production deployment jobs succeeded. Its build job executed `npm run lint` and `npm run typecheck`; these are not inferred from a build-only result. Run logs explicitly show all eight `packages/rights-session-broker/src/sessionResources.test.ts` tests passing in shard 14, covering listener cleanup, both detach orders, stale socket close, absolute expiry, late listeners, cleanup errors and deadline rejection.

The staging job ran `e2e/staging-public.spec.ts` against `https://indii-music-studio--staging-13crcg86.web.app` and reported **2 passed**, not skipped. Source inspection shows phone-viewport privacy/terms/invalid-upload-link/login routes and a signed-out root sign-in form. It contains no account creation or signed-in rights workflow. The account plan is therefore unobserved. This is limited staging public-path CI evidence, not production customer acceptance.

The production job succeeded through its configured deployment steps. The owner initiated this workflow by merging; this audit did not dispatch another deployment.

## What this proves and what it does not

This satisfies the proposal's explicit requirement to link current-main lint, typecheck, relevant tests and required CI to an exact successful SHA. The historical proposal heading is preserved; the new status and terminal evidence identify this completed gate.

Unit tests include legacy structural/mocked suites and must not be relabelled as customer journeys. A green deployment job does not prove a hosted broker's running revision, provider receipt, legal filing, payment, signed release, or installed-platform user path. No genuine account was created or plan/tier observed for this audit. The other proposals and numbered-issue acceptance remain separate.

The default `build.yml` branch workflow compiles the Electron app but does not package it unless the separate installer path is invoked. Its green status is not evidence that `afterPack` ran. Actual catalog package validation remains pending the prepared CI-only proposal/owner approval, following a local production-preflight stop for missing configuration/credentials. No preflight bypass or alternate credentials were used.

Unmerged render, track-ownership, client-routing, packaged-storage and DAW branches are not included in this main result. Each has its own SHA/CI and outstanding acceptance; none is declared deployed by this audit.
