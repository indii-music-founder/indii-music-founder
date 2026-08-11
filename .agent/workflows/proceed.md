---
description: Resume and reconciliation gate for an interrupted or handed-off objective. Verifies the current request, handoff, diff, mainline state, scope, and evidence before continuing edits.
---

# /proceed — Resume and Reconcile

Use when the user says continue, proceed, resume, or supplies an existing handoff.

## 1. Reconstruct truth

Read in precedence order:

1. current user request;
2. actual repository/external state;
3. current diff and test evidence;
4. relevant handoff/checkpoint;
5. task, plan, flowchart, and ledger artifacts.

Downgrade any completion claim that current state does not prove. Do not let a stale task file redefine the objective.

## 2. Reconcile repository state

Before code, git, CI, or push actions, read [`branch-safety.md`](branch-safety.md). Fetch `origin`, require `main`, compare `origin/main...HEAD`, and inspect the dirty tree. Separate current-task files from unrelated work. Never auto-stash, auto-branch, rebase, stage, commit, or overwrite someone else's files.

## 3. Recheck authority and prerequisites

- preserve the original task authority; resuming does not add external, destructive, paid, or delivery permissions;
- confirm credentials and tools are still available;
- read `.agent/REAL_USER_AUTHENTICITY.md` before resuming a live-user or production proof path;
- use `/skill-skill` if the original tool is stale, unavailable, quarantined, or repeatedly failing.

## 4. Verify the restart point

Identify the last acceptance criterion with current evidence and the first one without it. Re-run the narrow decisive check at that boundary. Resume through `/middle` only after the handoff and actual state agree.

```text
RESUMED OBJECTIVE: <objective>
HANDOFF TRUST: <verified | partial | stale>
REPOSITORY STATE: <branch/head/origin/dirty scope>
LAST VERIFIED: <criterion + evidence>
FIRST UNVERIFIED: <criterion>
AUTHORITY / PREREQUISITES: <state>
NEXT: <coherent verification unit or exact blocker>
```

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
