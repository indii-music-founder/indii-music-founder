# /away — The Autonomous CI Monitor & Merge Loop

**Purpose:** Monitor exact-SHA CI for a published task PR, fix logged failures on that branch, and report review readiness.

## 1. Monitor the Exact CI Run
- Require the current branch to match the PR head, then monitor the GitHub Actions run for that exact SHA.
- Use the available GitHub connector or authenticated `gh` CLI to wait for the exact-SHA run. Browser automation is not required for CI status.

## 2. Fix Errors (If Red)
- If a failure is reported, review the specific error logs.
- Fix only the root cause shown in the run logs, run local validations (`typecheck`, `test`), create one coherent follow-up commit, and push to the same task branch.
- Loop back to Step 1 and watch the new exact-SHA pipeline run.

## 3. Report Review Readiness (If Green)
- Confirm the successful run belongs to the PR head SHA.
- Report the green SHA and run URL. Merge only after the required `test` check and user authorization.
> **Protected main delivery gate:** Before any code, git, CI, or push action, read and obey [`branch-safety.md`](branch-safety.md). Deliver through a focused branch and CI-checked PR; direct pushes to `main` are prohibited.
