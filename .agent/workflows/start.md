---
description: Flagship orientation workflow for a new objective. Establishes source of truth, request mode, task profile, authority, repository state, capability route, and definition of done before mutation.
---

# /start — Orientation

Use `/start` at the beginning of a new objective. It makes the task executable without turning every request into a repository-wide ceremony.

## 1. Establish the active contract

Record:

- the user's current objective and requested outcome;
- request mode: Explain, Review, Diagnose, Modify, Deliver, or Sensitive;
- authoritative inputs and stale artifacts that must not override the user;
- scope boundaries, exclusions, and unrelated dirty files;
- definition of done and required evidence;
- external writes, destructive actions, material cost, or credentials that would need separate authority.

## 2. Classify the profile

| Profile | Typical task | Start behavior |
| --- | --- | --- |
| T0 | Explain, inspect, review | Remain read-only; no ledgers, diagrams, health writes, commits, or delivery. |
| T1 | Localized bounded change | Inspect affected surface and define focused proof. |
| T2 | Cross-module/schema/API change | Map dependencies, contracts, rollback, and integration evidence. |
| T3 | Security, migration, live-user, production, paid, or irreversible work | Add authenticity, credential, rollback, failure-state, and stop-condition contracts. |

Explicit `/start` remains honored at every tier; the tier changes only the amount of relevant work.

## 3. Reconcile repository state when applicable

Before code, git, CI, or push actions, read [`branch-safety.md`](branch-safety.md). Fetch `origin`, require current `main`, compare `origin/main...HEAD`, and inspect `git status --short`. Do not auto-rebase, branch, stash, stage, or overwrite unrelated work.

For a read-only non-repository request, skip git mutation and report only the context needed.

## 4. Select capabilities

Invoke [`/skill-skill`](skill-skill.md) early when routing is ambiguous or specialized tools are likely. Require a current capability catalog, minimal sufficient toolchain, authority envelope, prerequisites, verifier, and fallback. Routing never expands authority.

## 5. Load only relevant context

- Use `/opp` for a stale or missing handoff, not automatically for every small task.
- Run `health-check` only when a baseline/delta helps the task; never write baseline hits to a permanent issue ledger automatically.
- Use `zoom-out` or `/flowchart` only when multi-component state, ownership, or sequence is materially clearer visually.
- Read the Error Ledger only for a reproduced failure or known relevant pattern; validate remembered fixes before reuse.
- Read `.agent/REAL_USER_AUTHENTICITY.md` before live-user, browser E2E, release-acceptance, demo-readiness, production, or free-tier claims.

## Output

```text
OBJECTIVE: <current user objective>
MODE / PROFILE: <mode> / <T0-T3>
SOURCE OF TRUTH: <inputs>
AUTHORITY: <read-only | local writes | repository delivery | named external writes>
SCOPE / EXCLUSIONS: <boundaries>
TOOLCHAIN: <ordered certified/conditional capabilities>
DEFINITION OF DONE: <observable criteria>
FIRST VERIFICATION UNIT: <next bounded action>
```

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
