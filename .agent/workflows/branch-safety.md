# Agent delivery through Entire branches

Coding agents publish locally validated work on task branches through Entire. The team handles review, remote CI, and merging to `main`.

## Start from current main

1. Read this policy before code, Git, CI, or push actions. Confirm that `origin` points to the repository's `entire://` remote. Fetch `origin` and inspect the worktree. Preserve concurrent and unrelated changes.
2. Create a fresh `codex/<task>`, `claude/<task>`, or `antigravity/<task>` branch from current `origin/main` for each coherent batch.
3. Stage only files that belong to the batch. Run the relevant local validation and commit the changes. Check the latest `origin/main` before publication. If the base changed in ways that affect the batch, integrate those changes safely and rerun the affected local checks.

## Publish the branch

1. Push through `origin` with an explicit refspec, such as `git push origin HEAD:refs/heads/codex/<task>`. If the user asks for an Entire Trail, use `entire agent-help trail` for the publication and linking commands.
2. Report the branch, commit SHA, local verification, and any acceptance work that remains. Continue with the next batch as requested. Remote CI status, GitHub review requests, pull requests, and merging are outside this delivery workflow.
3. If authentication expires, surface the official Entire login flow. Preserve branch protections and existing history. Never force-push or change the remote to deliver a task.
