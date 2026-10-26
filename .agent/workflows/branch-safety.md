# Protected Main Delivery Gate — Mandatory for Every Slash Workflow

`main` is protected by the `main-branch-protection` GitHub ruleset. This file is the authoritative delivery policy when older workflow instructions conflict with it.

## Before editing

1. Run `git fetch origin` and inspect `git status --short --branch`. Preserve unrelated work and coordinate with other agents.
2. Create a focused `codex/` task branch from current `origin/main` in a clean checkout. Do not reuse a stale branch for a different issue.
3. Make one coherent change and run the local checks relevant to it. Never create checkpoint commits, weaken tests, or mix unrelated work.

## Publish and review

1. Fetch again before publishing. If `origin/main` advanced, inspect the change and integrate safely without overwriting concurrent work. Never force-push or rewrite `main`.
2. Push the task branch with an explicit refspec such as `git push origin HEAD:codex/issue-1234-description` and open a PR targeting `main`.
3. Verify the remote branch SHA, PR head SHA, and CI run for that exact SHA. Fix only logged failures on the same branch, then repeat the exact-SHA check.
4. Merge only when the PR has its required `test` check and the user has authorized that merge. Do not bypass the ruleset, self-approve, or push directly to `main`.
5. Report the PR, SHA, validation, review/merge state, and any genuine-user or deployment acceptance still outstanding. A published branch alone is not a completed delivery.

## Credentials and concurrent work

Expired credentials require the official authorization flow in `AGENTS.md`. Do not switch accounts, use a secret from another source, or bypass protected-branch settings. Keep unrelated uncommitted work and artifacts intact. Do not delete another agent's branch or worktree.
