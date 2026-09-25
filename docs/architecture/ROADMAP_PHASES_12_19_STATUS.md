# Canonical Roadmap Engineering Status: Phases 12–19

As of 2026-09-25 15:05 UTC. This is a verification ledger, not a claim that
open phase branches have passed their sequential acceptance gates.

## Repository and delivery state

- Repository: `indii-music-founder/indii-music-founder` only.
- Current remote `main`: `0cb8247299d88c4b9300d50f09d45ed1dae8b795`.
- Current task branch: `feat/canonical-music-persistence-boundary-20260925`.
- Local task commit: `0c7446cbdae286b7f037d2ddf04c378e4141c215`, based on
  `0e51e034084452ee441c9fee8bba736099694b28`; it is one commit ahead and one
  behind current `origin/main`.
- The task branch is local only: not pushed, no PR. The configured GitHub CLI
  and SSH identities do not match; no identity switch or push has been
  performed pending user authorization.
- No PR has been merged by this task; production was not initiated by this
  task.

## Phase gates

| Phase | Current evidence | Gate / remaining work |
| --- | --- | --- |
| 12 — Claims + Conflict Intelligence | PR #305 merged at `2acbcb08df8e52bceef6cc0468d199eee1098251`; its setup, tests, and build checks succeeded. | Phase gate passed. |
| 13 — Advanced Catalog Intelligence | Main contains combined implementation commit `ab2c6b547`. PR #304 head `57aeb386845aab7f409c0adbe342d4d748064c17` has successful exact-head checks but is conflicting. | PR #304 explicitly describes a safe partial slice. This local branch adds an owner-only bounded canonical snapshot reader, an authenticated/App Check/Arcjet/entitlement-protected deterministic report callable, and a fail-soft Registration Center consumer displayed separately from legacy `users/{uid}/tracks` findings. No canonical write flow populates the new store, no migration/linkage policy exists, and no claim of complete coverage is made. Do not infer legacy completeness, identity, registration, ownership, or rights. |
| 14 — Workflow Prediction | PR #307 head `30d703067e076769e547c52868c38d40e0b2b2d8` has successful checks. | Conflicting and based on `d4ec80440c05449a9bb1ffe5b98c2575b94ac8de`; hold until Phase 13 is accepted and the branch is reconciled by its owner. |
| 15 — Cross-Department Intelligence | PR #308 head `695dfa00538f125f989ed0060af0543e3914cc2a` has successful checks. | Mergeable against `2acbcb08df8e52bceef6cc0468d199eee1098251`, but stacked on later phase work; do not accept before 13–14. |
| 16 — Advanced DDEX / Industry Interoperability | PR #310 head `8704464f549ff301c49970546d17f0592921c0d5` has successful checks. | Mergeable against the Phase 12 base, but stacked on later phase work; hold for sequence. RDR-RCC values remain caller-supplied; no signing, persistence, upload, or transmission is added. |
| 17 — AI Usage Rights | PR #311 head `b09f1b3e15c86d6985913ffa0c4231b458fe32cb` has successful checks. | Mergeable against the Phase 12 base, but stacked on later phase work; hold for sequence. AI-use evidence remains separate from clearance and execution authority. |
| 18 — Local / Off-Grid Intelligence | PR #312 head `b2abfd1f80b179e15b1d51449f3d1167363bc313` has successful checks. | Conflicting. The described scope is local technical/media inspection; it does not establish general offline capability or promote detected metadata. |
| 19 — Full Founding Owner System | PR #313 head `a81a6caaa9cbc140575554aecd3b9fab5186cf24` has successful checks. | Mergeable against the Phase 12 base, but stacked on later phase work; hold for sequence. Server-owned entitlements and evidence-backed capability results must remain authoritative. |

Passing checks on a stacked PR head do not establish that every preceding
phase is accepted. No open PR above has been merged by this task.

## Local persistence boundary

Commit `0c7446c` adds a server-only Firestore adapter using existing canonical
schemas, create-only writes, owner-scoped authorization, internal IDs, and
client-denied subcollections. The current uncommitted follow-up adds a
deterministic paginated read projection, bounded to 5,000 records per source
collection and 4 MB serialized total. It validates records and document IDs;
it reports `UNKNOWN` unless a bound forces `PARTIAL`, never `COMPLETE`, because
legacy data has not been migrated. A callable reuses the existing admission
policy, and the UI consumes its review-only report without blocking or
relabeling legacy results. This does not add a canonical write flow, migrate
legacy data, upgrade provenance, or authorize rights/registration/execution.

Local checks on the follow-up: 15 focused Firebase tests, 6 focused renderer
tests, Firebase build, shared typecheck, Firebase lint (no errors; 14 existing
warnings), changed-renderer ESLint, and tracked diff whitespace validation
passed. Renderer workspace typecheck was attempted but could not complete
because `@react-three/fiber` and `@react-three/drei` are declared dependencies
and lockfile entries but absent from this checkout's `node_modules`; resulting
errors are in existing canvas components, not changed files. Earlier checks
also passed capability catalog validation. The Firestore rules emulator test
was added but not run locally. Full repository CI and exact-SHA GitHub CI
remain unavailable because the branch has not been pushed.

## CI and production safety

- Main SHA `0e51e034084452ee441c9fee8bba736099694b28` was tested by run
  [36135962353](https://github.com/indii-music-founder/indii-music-founder/actions/runs/36135962353).
  All listed test, build, rules, staging, and production jobs concluded
  successfully, but the overall workflow is marked cancelled after a force
  cancellation request. Its production job completed Cloud Functions,
  Firebase Hosting, Firestore rules/indexes, Storage rules, and deterministic
  media-worker deployment before cancellation.
- The newer run
  [36138391004](https://github.com/indii-music-founder/indii-music-founder/actions/runs/36138391004)
  for current `main` SHA `0cb8247299d88c4b9300d50f09d45ed1dae8b795` was
  cancelled before setup completed; it does not provide full exact-SHA CI.
- No deployment, production write, rollback, legal attestation, paid action, or
  external transmission is authorized by this task.

## Next safe unit

Phase 13 still needs a canonical write path and an explicit migration/linkage
policy before real catalog coverage can be established; then it needs
exact-SHA CI and sequential acceptance. Keep canonical findings separate from
legacy projections; do not merge identities or claim completeness. Resolve the
GitHub identity authorization before pushing this branch. Do not update another
agent's open PR branch or merge phases out of order.
