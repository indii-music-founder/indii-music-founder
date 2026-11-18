# /PP — Perfect Primitive

Shared team workflow for hardening foundational runtime, UI, relay, hook, store, and rules primitives across **Claude**, **Codex**, and **Antigravity**.

## Canonical Protocol

Read and follow **`.agent/workflows/PP.md`** step-by-step (plus **`.agent/workflows/branch-safety.md`** before any git/push action):

1. **Memory & Scope:** Inspect `.agent/skills/error_memory/ERROR_LEDGER.md`, `.agent/HANDOFF_STATE.md`, `.agent/REAL_USER_AUTHENTICITY.md`, and `docs/PLATINUM_QUALITY_STANDARDS.md`. Pick 1–3 tightly coupled primitive defects in one subsystem.
2. **Test-First Fix:** Write or extend failing regression tests reproducing the broken primitive, implement the complete minimal fix, and sweep sibling call sites (`rg -n`) for the same defect class.
3. **Ledger & Honesty:** Add any novel `UPPER_SNAKE_CASE` primitive pattern to `.agent/skills/error_memory/ERROR_LEDGER.md`, update `.agent/HANDOFF_STATE.md`, and keep mock-backed structural checks strictly distinct from live/production verification.
4. **CLI Verification & Delivery:** Run affected Vitest suites, `npx eslint --max-warnings=0` on touched files, `typecheck`, `git diff --check`, and deliver one coherent commit directly to `origin/main` via `git push origin HEAD:main`, then verify exact-SHA CI.
