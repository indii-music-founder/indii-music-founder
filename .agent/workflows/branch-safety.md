# Mainline Delivery Gate — Mandatory for Every Slash Workflow

> This is a hard stop, not advice. The repository operates directly on `main`. Do not create, use, or push a task branch unless the user explicitly requests that exact branch workflow.

## Non-negotiable rules

1. **Use `main` as the single delivery lane.** Before changing code, run `git fetch origin`, confirm the current branch is `main`, confirm the worktree does not contain unrelated changes, and fast-forward local `main` to `origin/main`. Do not begin work from a stale local commit.
2. **No automatic branch creation.** Slash workflows, agents, tests, fixes, checkpoints, and CI recovery all remain on `main`. A branch or PR is allowed only when the user explicitly requests it for the current task.
3. **One coherent commit at a time.** Collect the task's related changes, run the relevant local validation, and create one purposeful commit. Do not emit session-checkpoint, save-state, polling, or one-commit-per-micro-fix history. Never mix unrelated work into the commit.
4. **Synchronize without rewriting history.** Immediately before committing or pushing, fetch again and require local `main` to be based on current `origin/main`. If `origin/main` advanced, stop and integrate it safely before continuing. Never force-push, reset, or rewrite `main`.
5. **Push only the validated commit directly to `origin/main`.** Use an explicit refspec: `git push origin HEAD:main`. Never run an ambiguous push and never push a different local branch to `main`.
6. **CI is the remote acceptance gate.** After the push, identify the workflow run for the exact pushed SHA and inspect its actual logs. If it fails, fix only the observed root cause on `main`, validate, make one follow-up commit, push, and repeat until that SHA's successor is green. Do not guess, delete tests, weaken assertions, or open side branches to hide a red run.
7. **A green run ends the delivery cycle.** Report the pushed SHA, local validation, CI run URL/status, and any follow-up fix SHA. Do not continue adding opportunistic changes after green.

## Required pre-push evidence

```bash
git fetch origin
test "$(git branch --show-current)" = "main"
git merge-base --is-ancestor origin/main HEAD
git rev-list --left-right --count origin/main...HEAD
git status --short
```

Expected immediately before the commit: `main`, clean except for the current task, and zero historical divergence. Expected immediately before the push: `main` is zero behind and exactly one coherent validated commit ahead.

## Explicit branch exception

If the user explicitly requests a branch, state the branch name and purpose, create it from current `origin/main`, keep it task-specific, and do not merge, rebase, force-push, delete, or open a PR without the user's matching instruction. After that task, return to the mainline standard.

## Legacy branch recovery

Do not merge the existing stale branches into `main`. Preserve them until separately authorized for cleanup. Recover only explicitly requested changes by applying their minimal patch directly to current `main`, validating it, and delivering it through the single-mainline cycle above.
