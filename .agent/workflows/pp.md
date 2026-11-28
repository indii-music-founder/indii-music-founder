---
description: Canonical Perfect Primitive workflow for Gemini Antigravity, Codex, and Claude. Supports audit-only reviews and gives implementation runs a goal with verifiable completion criteria.
---

# /pp — Perfect Primitive (Antigravity + Codex + Claude)

Use `/pp` to audit, harden, or repair foundational application primitives across client services, relay/executor transport, tools, hooks, stores, rules, or UI controls. Treat `/pp`, `/Pp`, `/pP`, `/PP`, and `$pp` as requests for this same workflow. Use `/pp` when selecting the command in a case-sensitive menu. This file is the canonical contract for every runtime.

## Runtime Discovery

| Runtime | Canonical contract and entry-point rule |
| --- | --- |
| **Gemini Antigravity** | The [workspace discovery manifest](../../.agents/skills.json) points to the [Perfect Primitive skill](../skills/pp/SKILL.md), which opens this workflow. On hosts without skill discovery, ask the agent to follow `.agent/workflows/pp.md` directly. |
| **Codex** | Follow `.agent/workflows/pp.md` through the repository instructions or a Codex skill that links to it. |
| **Claude** | `.claude/commands/pp.md` is a thin adapter; follow `.agent/workflows/pp.md` for the full protocol. |

Do not assume a machine-local entry point exists. Verify it before referencing it or claiming that runtime has a synchronized mirror. If the host cannot load this file, report that as an entry-point gap and provide the canonical path; do not silently substitute a shortened protocol.

## 0. Choose the requested mode

- **Audit-only (default for “review”, “diagnose”, or “what remains?”):** inspect evidence and return ranked findings with file/symbol locations, impact, reproduction or proof, confidence, and a proposed bounded verification unit. Do not edit, test, or deliver unless the user also asked for implementation.
- **Implement (for “fix”, “harden”, “proceed”, or equivalent):** execute the bounded unit through `/middle` and `/go`, then close it through `/end`.

For a broad primitives review, inventory and prioritize the findings first. Do not automatically turn the entire inventory into one implementation unit.

## 1. Shared Memory & Delivery Guard

Before inspecting or editing code:

1. Read [`branch-safety.md`](branch-safety.md) and the repository's `.entire/agent-guide.md`. Inspect `entire status` and `git status --short`; use `entire` for repository fetch/push, session, checkpoint, search, and trail operations. Keep `origin` pointed at Entire. Follow `branch-safety.md` for the current delivery lane; never infer branch authority from this workflow. If its preconditions fail, stop delivery and report the exact blocker. If another session occupies the shared checkout, work in an isolated checkout based on `origin/main` (see section 5). Preserve unrelated dirty files without staging, stashing, reverting, or committing them.
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

## Set the implementation goal

Once the implementation scope is clear, start tracking the goal before the first edit. Write it in a few sentences. Name the primitive and the improvement the user should experience, encourage the agent to follow through on recoverable failures, and spell out what evidence will show the work is done. Include delivery only when it is part of the request.

> Make saving dependable so artists can trust that their work will be there when they return. Follow the evidence through each recoverable failure and check every caller that shares this save path. Finish when the regression check proves that a failed save is visible and can be retried, and the relevant checks pass.

- Check for a matching unfinished goal and reuse it on repeated calls or resumes. When the host exposes a goal tool and permits automatic creation for this request, create one goal for the agreed scope. In Codex, check with `get_goal` before calling `create_goal`. Leave any unrelated unfinished goal in place.
- When a native goal cannot be created or reused, use the host's task tracker if available or state the goal and completion criteria in the session. This gives Gemini Antigravity, Claude, and other hosts the same objective to carry through `/middle`, `/go`, and `/end`.
- When Antigravity exposes `/goal` only in the user's composer, use the fallback above. If the user wants native goal mode, provide `/goal` followed by the proposed objective and preserve any existing active goal.
- At closeout, compare the result with each completion criterion. Mark a tracked goal complete only when the requested work and its evidence are in place. If required work remains, record the next action or exact blocker and keep the goal unfinished.

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

## 5. Proportional Verification & Delivery (`/ci-validate` + `/end`)

Run after the final edit (CLI-first so every team gets deterministic evidence):

1. Affected unit/component tests (`npx vitest run <targeted-test-files>`).
2. Strict lint with zero warnings (`npx eslint --max-warnings=0 <touched-files>`).
3. Affected package TypeScript check (`npm run typecheck:renderer` / `npm run typecheck`) and `git diff --check`.
4. Repo policy guards when workflows or capabilities change (`npm run validate:capabilities`, `npm run validate:mainline-workflows`).
5. Deliver one coherent commit through [`/end`](end.md) and [`/ci-validate`](ci-validate.md) on a fresh task branch from current `origin/main`, pushed through Entire `origin` as [`branch-safety.md`](branch-safety.md) specifies. If unrelated work occupies the shared checkout, use an isolated checkout based on `origin/main`. Report the branch, commit SHA, and local verification; the repository owner handles remote CI and merging to `main`.

> **Mainline delivery gate:** Read [`branch-safety.md`](branch-safety.md) before code, git, or CI actions. It defines delivery through Entire, including the automatic Trail route for protected `main`.
