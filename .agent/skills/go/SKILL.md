---
name: go
description: Recursive execution motor for an active indii objective. Use when the user invokes /go or @go, asks to continue autonomously, wants a blocker driven to resolution, or needs the current task carried from implementation through proportional verification and delivery. It works in coherent verification units, preserves the direct-main policy, and never creates checkpoint or micro-fix commits.
---

# Go

Drive the current objective to an evidence-backed terminal state. The active user request outranks stale task files, old checkpoints, and legacy ledgers.

## 1. Reconstruct current state

Before changing anything:

- state the active objective and definition of done;
- inspect the current diff, branch, `origin/main` relationship, and relevant handoff;
- separate current-task files from unrelated dirty files;
- identify completed, active, blocked, and unverified acceptance criteria;
- read `.agent/workflows/branch-safety.md` before code, git, CI, or push actions;
- use `/skill-skill` when a specialized capability or multi-tool chain is likely.

Never overwrite, stage, stash, commit, or attribute unrelated work.

## 2. Choose one coherent verification unit

A unit may contain several tightly coupled edits when they share one contract and one proof surface. Do not force one line, one file, or one micro-task per cycle.

For the unit:

1. State the expected behavior and failure signal.
2. Reproduce or add a test when behavior is objectively testable.
3. Implement the smallest complete mechanism.
4. Verify affected callers, schemas, shared literals, and state transitions.
5. Run the narrowest decisive checks, escalating with fan-out and risk.
6. Apply `/better` only to the bounded files when a real quality opportunity remains.
7. Update a diagram or durable ledger only when the unit produced verified, reusable state that belongs there.

Keep related work uncommitted until the complete task is ready for its one coherent delivery.

## 3. Blocker and strike handling

Classify the blocker before acting:

- **Code/test:** reproduce, diagnose, fix the logged cause, add regression evidence.
- **Architecture:** inspect dependencies and contracts; use `zoom-out` or a relevant diagram when relationships are genuinely hard to reason about linearly.
- **Tool unavailable:** choose a Certified fallback from the catalog.
- **Authentication:** use the official sign-in or authorization flow; never switch identities or harvest credentials.
- **External authority/material cost/destructive action:** pause and name the exact permission required.
- **Unrelated dirty state:** isolate by scope and continue only when safe.

After two failed attempts with the same mechanism, stop that approach, add instrumentation or a deterministic reproducer, and make an architectural pivot. Do not lower acceptance criteria.

## 4. Evidence and authenticity

- Tests prove only the contract they exercise.
- UI proof uses an approved available browser capability and follows `.agent/REAL_USER_AUTHENTICITY.md`.
- Mock, emulator, local-real, and production-real results remain distinct.
- Never say a partner, customer, deployment, billing path, or provider accepted something without genuine external evidence.

## 5. Completion and delivery

When every acceptance criterion has decisive evidence:

1. Re-read the bounded diff and run proportional final checks.
2. Invoke the canonical `/end` workflow for repository closure.
3. Let `/ci-validate` perform observational validation; repairs return here and address only logged in-scope causes.
4. If repository delivery is part of the active request, create one coherent commit on `main`, push only with `git push origin HEAD:main`, and inspect CI for the exact SHA.

Do not create WIP, checkpoint, per-iteration, or speculative repair commits.

## Progress update

Report only meaningful state changes:

```text
OBJECTIVE: <active objective>
UNIT: <coherent work unit>
STATE: <completed | active | blocked | verifying>
EVIDENCE: <decisive result or missing proof>
NEXT: <next action inside current authority>
```
