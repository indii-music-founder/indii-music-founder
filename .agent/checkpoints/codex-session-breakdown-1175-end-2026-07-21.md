# Checkpoint: Codex (Session Breakdown — ISSUE-1175 Foundation)

**Date:** 2026-07-21
**Branch:** `main`
**Delivery commits:** `3c67c50f7`, `34a98f2a5`, `c1dbee987`
**Green exact-SHA workflow:** [29874018363](https://github.com/indii-music-founder/indii-music-founder/actions/runs/29874018363)

## Final state

- ISSUE-1175 is **OPEN/PARTIAL**, not fixed. ISSUE-1176 through ISSUE-1181 are **OPEN and unstarted**.
- The strict delivery order and acceptance-evidence gates are encoded in `.agent/skills/session-breakdown-delivery/SKILL.md` and `docs/flowcharts/session-breakdown-roadmap.md`.
- The deployed foundation covers shared contracts, owner-bound resumable staging, immutable original finalization, cancellation, client/server ownership rules, renderer upload orchestration, and the deterministic FFmpeg proxy core.
- The unrelated test-ledger deletion/archive migration and the uncommitted skill-evaluation workspace were deliberately left untouched.

## Verification evidence

- Focused implementation suites: 16 tests passed.
- Firebase emulator ownership boundary: 158 Firestore/Storage assertions passed.
- Python media fixtures: 2 tests passed, including a real FFmpeg synthetic source.
- Firebase, shared, and renderer TypeScript/package checks passed; focused ESLint and `git diff --check` passed.
- Final `/end` health: dependency drift clean; integration health 7 passed and 33 credential-dependent tests skipped; detector baseline `169`, final `169` (no regression).
- Exact-SHA CI `c1dbee987`: setup, all 20 unit-test shards, lint/typecheck/build, staging deploy, staging E2E, and production deploy passed.

## Remaining ISSUE-1175 acceptance work

1. Connect the media worker to generation-pinned private GCS input and persist a retry-safe completed `ProxyManifest` through a durable lease/queue.
2. Implement cost reservation and settlement, restart-safe upload recovery, retention cleanup, dependency-aware deletion, and cancellation/finalization race handling.
3. Add representative rotated VFR HEVC/HDR fixtures and prove proxy-to-original timing at beginning, middle, and end.
4. Build the Creative Video session UI and run a real authenticated interrupted-upload-to-private-proxy smoke test.
5. Keep ISSUE-1176 blocked until every ISSUE-1175 acceptance item is evidenced and the canonical ledger can honestly be changed from OPEN.

## Operational notes

- Storage event triggers accept at most 540 seconds; keep the finalizer bounded and enqueue long transcoding work elsewhere.
- Use the project-local Firebase CLI on this space-containing workspace path.
- Skill-evaluation viewer remains local at `.agent/skills/session-breakdown-delivery-workspace/iteration-1/review.html`; revise the skill only after founder review.
