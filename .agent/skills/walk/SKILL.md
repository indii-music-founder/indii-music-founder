---
name: walk
description: Resume a mobile or interrupted indii session from its handoff and drive that same objective to verified completion. Use when the user says /walk, “I’m home,” “pick up where we left off,” or asks to continue from a mobile session. Reconcile the handoff with current main and the actual diff before editing; never assume stale checkpoints are authoritative.
---

# Walk

Resume the interrupted objective without creating a second task or sweeping unrelated repository work.

## 1. Reconcile the handoff

Read, in order:

1. the current user request;
2. `.agent/HANDOFF_STATE.md` and the relevant recent checkpoint;
3. `git status --short`, current branch, `HEAD`, and `origin/main`;
4. the active diff and any referenced task/plan/issue source.

The current user request wins over stale artifacts. If the handoff claims work that the diff or tests do not support, downgrade it to unverified.

Before code, git, CI, or push actions, read `.agent/workflows/branch-safety.md`. Stay on `main` unless the user explicitly requested a branch workflow. Preserve unrelated dirty files and report them.

## 2. Restore the feedback loop

- Identify the last verified acceptance criterion and the first missing one.
- Re-run the narrow check that proves the handoff is still valid.
- If the task is a known bug, reproduce it before fixing.
- If the required environment, credentials, or external service is unavailable, surface the official prerequisite instead of simulating it.

## 3. Continue through `/go`

Use the canonical `/go` workflow in coherent verification units. Keep the resumed task's related changes together; do not create WIP, checkpoint, or per-unit commits.

Apply the two-strike pivot: after two failed attempts with the same mechanism, instrument or redesign rather than repeating cosmetic patches.

## 4. Close the original objective

When the acceptance criteria are met:

1. Re-read the bounded diff.
2. Run proportional tests, typecheck/lint, build, integration, and visual checks.
3. Follow `/end` and observational `/ci-validate`.
4. If repository delivery is part of the resumed objective, create one coherent commit and push only with `git push origin HEAD:main`.
5. Inspect the exact-SHA CI run and fix only logged in-scope causes until green.

## Handoff report

```text
RESUMED OBJECTIVE: <objective>
HANDOFF TRUST: <verified | partially verified | stale>
COMPLETED: <acceptance evidence>
REMAINING: <none or exact blocker>
REPOSITORY: <main/tree/SHA state>
DELIVERY: <not requested | local only | exact SHA + CI URL>
```
