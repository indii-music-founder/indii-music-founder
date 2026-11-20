# Mainline delivery through Entire

All coding agents use this policy. `main` is the delivery target and `origin` stays on Entire. The owner has authorized the task branch, Trail publication, and gated merge described here for normal repository delivery. This standing authorization supersedes older direct-push-only instructions. Approval is still required for scope changes and for actions outside normal repository delivery.

## Start from current main

1. Confirm that `origin` points to the repository's `entire://` remote. Fetch `origin`, inspect the branch and working tree, and use a clean checkout based on `origin/main` for new work. Preserve concurrent and unrelated changes.
2. Keep the active task to one coherent, locally validated commit. Stage only task files. Check the latest `origin/main` again before publication. If it moved, integrate it safely and rerun affected checks. Preserve existing history.
3. Use the Trail route below immediately for this GitHub mirror. For a repository where Entire permits direct pushes, the direct route is `git push origin HEAD:main` from current local `main` only. If Entire rejects it with a protected-branch error, preserve the verified commit and use the Trail route. A transport, permission, or authentication error requires its own diagnosis.

## Publish and land through a Trail

1. Use one task-specific branch based on `origin/main`, with a unique name such as `codex/<task>`, `claude/<task>`, or `antigravity/<task>`. Keep an existing validated commit if its base is current. If the commit was made on local `main` and the base moved, copy the task changes to a fresh branch from `origin/main` and validate again. Leave unrelated branches and local `main` history intact.
2. Use `entire agent-help trail` and the subcommand help for installed CLI flags. Use `entire trail show` on the current branch to find a linked change. Reuse the existing Trail for the task. For new work, run `entire trail create --base main --branch <task-branch> --type task --title <title> --body <scope-and-verification>` from the task checkout. It publishes the committed branch through `origin` and links the change. If linking fails after a branch or Trail was created, recover that existing state with `entire trail link`.
3. Keep the Trail description current. Use `entire trail show` to verify the branch, base, and gates. Wait for any scheduled checks for the exact task SHA, inspect failures, and fix observed root causes on the task branch. Use `entire trail merge --dry-run` to check readiness, then `entire trail merge` when all applicable gates pass. Use the full Trail or change URL in status reports.
4. Keep monitoring through merge and post-merge CI. Ask the user only for a gate that explicitly requires their approval, missing or expired credentials, or a decision outside the authorized scope. For authorization, surface the official flow and wait. Preserve protections, required checks, and approval gates.

## Verify the commit that lands

Fetch `origin` after merge and identify the exact commit produced by the Trail merge on `main`. Inspect that SHA's expected CI runs and logs. Documentation and policy changes use the `Docs and Policy Gate`. For application changes, monitor the applicable build, deploy, and acceptance checks. When the scope includes deployment, verify the requested behavior in the deployed environment under the [real-user authenticity standard](../REAL_USER_AUTHENTICITY.md).

If an expected run fails, fix only its logged root cause and deliver the follow-up through the same route. Report the landed SHA, checks, CI run URLs, and any verified deployment outcome. If the workflow triggers exclude the changed paths, report "Remote CI not scheduled for this path" and give the local verification. Stop after the relevant gates and requested acceptance checks pass.

Never force-push or rewrite `main`, manually create checkpoint commits, circumvent a merge gate, or change the remote to deliver a task. Other branch workflows and changes to repository settings require separate authorization.
