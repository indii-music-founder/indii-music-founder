---
description: Flagship closure workflow. Reconciles every promised acceptance criterion, runs proportional final proof and observational /ci-validate, publishes one coherent task branch PR, and verifies exact-SHA CI without post-gate edits.
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
- **TypeSafe closeout:** if judgments were used in this task, record in the handoff/ledger what was judged, the shadow/live mode, observed agreement, and token cost — and confirm no key material and no renderer-side judgment calls entered the diff.
- Run dependency drift/integrity checks only when manifests, locks, runtime packages, or dependency behavior changed.

## 4. Run proportional final proof

Use the verification matrix in [`ci-validate.md`](ci-validate.md). For repository delivery, run the full observational `/ci-validate` local gate. A failure returns to `/middle`; fix only the logged in-scope cause and rerun the invalidated checks.

## 5. Deliver when authorized

When the tree is clean for this objective and local validation passes:

1. stage only explicitly listed task files;
2. inspect the complete staged diff;
3. create one conventional task commit on the focused branch;
4. push with an explicit branch refspec and open a PR targeting `main`;
5. verify the remote branch and PR head SHA, then locate CI for that exact SHA;
6. inspect actual failed logs if red;
7. repair only logged root causes through `/middle` until the successor SHA is green;
8. merge only with the required review, check, and user authorization in [`branch-safety.md`](branch-safety.md).

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

> **Protected main delivery gate:** Before any code, git, CI, or push action, read and obey [`branch-safety.md`](branch-safety.md). Deliver through a focused branch and reviewed PR; direct pushes to `main` are prohibited.
