---
description: Perfect Primitive (/pp, /PP) shared workflow for Antigravity, Codex, and Claude teams. Audits, test-first hardens, sibling-sweeps, and delivers foundational primitives directly to main.
---

# /pp — Perfect Primitive (Antigravity + Codex + Claude)

Use `/pp` (or `/PP`, `$pp`) when auditing, hardening, or repairing foundational application primitives across client services, relay/executor transport, tools, hooks, stores, rules, or UI controls. Any agent runtime in this repository — **Antigravity** (and Gemini/Droid/Jules), **Codex**, or **Claude** — runs the exact same deterministic contract.

## Runtime Discovery

| Team / Runtime | Entry Surface |
| --- | --- |
| **Antigravity** / Gemini / Droid / Jules | `.agent/workflows/pp.md`, `~/.gemini/config/skills/pp/SKILL.md`, `~/.gemini/antigravity/global_workflows/pp.md`, `AGENTS.md`, `ANTIGRAVITY.md` / `GEMINI.md` |
| **Codex** | `AGENTS.md`, `CODEX.md`, `.agent/workflows/pp.md`, and `~/.codex/skills/pp/SKILL.md` |
| **Claude** | `.claude/commands/pp.md`, `~/.claude/commands/pp.md`, `~/.claude/skills/pp/SKILL.md`, `CLAUDE.md`, and `.agent/workflows/pp.md` |

## 1. Shared Memory & Delivery Guard

Before inspecting or editing code:

1. Read [`branch-safety.md`](branch-safety.md) and check `git status --short` + `git fetch origin`. Operate directly on `main` unless the user explicitly asked for a branch; preserve any unrelated dirty files or active concurrent work without staging, stashing, or reverting them.
2. Read the newest entries in `.agent/skills/error_memory/ERROR_LEDGER.md` and `.agent/HANDOFF_STATE.md` to avoid repeating known regressions or duplicating work already landed by another team.
3. Read `.agent/REAL_USER_AUTHENTICITY.md` and `docs/PLATINUM_QUALITY_STANDARDS.md`.

## 2. Primitive Defect Taxonomy (What to Hunt)

Select **1–3 tightly coupled primitive defects** in one coherent subsystem (never mix unrelated modules). Prioritize:

1. **False Success / Unawaited State Transitions:** Reporting `"Navigated"`, `"Saved"`, `"Sent"`, `"Approved"`, or `"Applied"` before `await`ing real confirmation (`navigateToModule`, non-null `commandId`, server ack, or store verification).
2. **Swallowed Rejections & Silent Failures:** Floating promises, empty `catch` blocks, unawaited persistence after external side effects, `HTMLMediaElement.play()` without rejection handling, or collapsing storage/network errors into empty-list UI without an actionable alert or retry path.
3. **Sticky Stale Caches & Auth Expiry Traps:** Multi-minute client caches (leases, tokens, signed URLs) that keep retrying a dead token instead of evicting on `permission-denied`, `unauthenticated`, or expiry rejection.
4. **Unmount, Cancellation & Stale Closure Races:** Post-`await` state updates, timers (`setTimeout` / `setInterval`), `MediaRecorder` / audio streams, uploads, or geolocation callbacks firing after unmount or superseding request IDs; same-handler `setState` followed by reading old closure state; `Promise.all` over non-idempotent side effects instead of `Promise.allSettled`.
5. **Interaction, Lifecycle & Accessibility Primitives:** Modals missing `Escape` key / backdrop dismissal or reduced-motion respect; hardware stop controls disabled when connection state drops mid-capture; cleanup leaks on unmount or page hide.
6. **Schema, Rules & Config Parity:** Client patch keys matching `firestore.rules` `affectedKeys().hasOnly([...])` and valid state transitions; approved model constants via `@/core/config/ai-models`.

## 3. Execute One Coherent Verification Unit (`/middle` + `/go`)

Follow [`middle.md`](middle.md) and [`go.md`](go.md) for each unit:

1. **State the contract:** Identify the exact broken primitive, user-visible failure mode, invariant, and bounded file list before editing.
2. **Test-first reproduction:** Add or extend focused regression tests reproducing the failure condition (avoid writing tests that pin mocked lies or fabricated IDs).
3. **Complete minimal mechanism:** Implement the full fix with zero placeholders, zero stubbed code, and zero opportunistic edits outside the unit.
4. **Sibling caller audit:** Search callers across the repository (e.g., `rg -n`) so another call site does not leave the same primitive broken.
5. **Run [`/better`](better.md)** on the bounded diff only if a material quality gain remains without expanding scope.

## 4. Record Reusable Lessons (`ERROR_LEDGER.md` & `HANDOFF_STATE.md`)

When a novel failure pattern is resolved:

- Prepend one concise entry in `.agent/skills/error_memory/ERROR_LEDGER.md` with an `UPPER_SNAKE_CASE` ID, affected files, root cause, fix, and prevention rule.
- Update `.agent/HANDOFF_STATE.md` with exact observed test counts and an honest authenticity note (`structural` mock-backed tests vs `local-real` vs `production-real` — never present mocked unit/component suites as live customer proof).
- Run scoped [`/sweep`](sweep.md) if any route, flag, symbol, or workflow doc changed.

## 5. Proportional Verification & Mainline Delivery (`/ci-validate` + `/end`)

Run after the final edit (CLI-first so every team gets deterministic evidence):

1. Affected unit/component tests (`npx vitest run <targeted-test-files>`).
2. Strict lint with zero warnings (`npx eslint --max-warnings=0 <touched-files>`).
3. Affected package TypeScript check (`npm run typecheck:renderer` / `npm run typecheck`) and `git diff --check`.
4. Repo policy guards when workflows or capabilities change (`npm run validate:capabilities`, `npm run validate:mainline-workflows`).
5. Deliver one coherent commit directly to `origin/main` via [`end.md`](end.md) and [`ci-validate.md`](ci-validate.md) using `git push origin HEAD:main` (if concurrent unrelated WIP occupies the shared working tree, commit and push cleanly from an isolated temporary worktree on `origin/main` without modifying the concurrent tree), then verify the exact pushed SHA in GitHub Actions.

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
