---
description: Flagship closure workflow. Reconciles every promised acceptance criterion, runs proportional final proof and observational /ci-validate, delivers one coherent main commit when authorized, and verifies exact-SHA CI without post-gate edits.
---

# /end — Closure

## 1. Reconcile the promise

List every acceptance criterion and classify it as proved, partial, blocked, or out of scope. Tie each proved item to decisive test output, DOM/external state, or an inspected artifact. Do not require raw output in the prose report when the exact tool log already preserves it; quote raw output when requested or needed to disambiguate a claim.

## 2. Inspect scope and state

Read [`branch-safety.md`](branch-safety.md). Re-read the complete bounded diff, run `git diff --check`, inspect `git status --short`, and report unrelated dirty files without staging, stashing, committing, or attributing them.

No placeholders, debug residue, secrets, generated junk, or unintended files may remain in the task scope.

## 3. Finish relevant artifacts only

- Run `/better` once on the final bounded diff if a meaningful quality pass remains.
- Update flowcharts only when the implementation changed relevant state, ownership, or sequence.
- Update checkpoints only with current reusable handoff state.
- Update issue/error ledgers only with verified unique facts; never self-verify external acceptance.
- Run dependency drift/integrity checks only when manifests, locks, runtime packages, or dependency behavior changed.

## 4. Run proportional final proof

Use the verification matrix in [`ci-validate.md`](ci-validate.md). For repository delivery, run the full observational `/ci-validate` local gate. A failure returns to `/middle`; fix only the logged in-scope cause and rerun the invalidated checks.

## 5. Deliver when authorized

When the tree is clean for this objective and local validation passes:

1. stage only explicitly listed task files;
2. inspect the complete staged diff;
3. create one conventional task commit on `main`;
4. push only with `git push origin HEAD:main`;
5. locate the remote CI run for that exact SHA;
6. wait for its final result and inspect actual failed logs if red;
7. repair only logged root causes through `/middle` until the successor SHA is green.

Missing GitHub credentials require the official `gh auth login` flow. Never harvest a PAT from `.env` or switch identities.

## 6. No post-gate edits

Any edit after a validation gate invalidates that gate. Do not modify code, docs, ledgers, checkpoints, or generated catalogs after the final pass without rerunning the relevant checks.

## Closeout report

```text
ACCEPTANCE: <criterion → evidence>
VALIDATION: <commands and verdict>
TREE: <clean | clean for objective + unrelated files>
DELIVERY: <not requested | local commit | exact SHA + CI URL>
AUTHENTICITY: <structural | simulated | local-real | production-real>
REMAINING: <none or exact blocker>
```

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
