# /away — The Autonomous CI Monitor & Merge Loop

**Purpose:** Executes an autonomous loop for `main`: monitor the exact CI run produced by a direct push, fix observed failures, and repeat until `main` is green.

## 1. Monitor the Exact CI Run
- Require the current branch to be `main`, then monitor the GitHub Actions run for the exact pushed SHA.
- Use the available GitHub connector or authenticated `gh` CLI to wait for the exact-SHA run. Browser automation is not required for CI status.

## 2. Fix Errors (If Red)
- If the subagent reports a failure, review the specific error logs provided.
- Fix only the root cause shown in the run logs, run local validations (`typecheck`, `test`), create one coherent follow-up commit, and deliver it through [`/end`](end.md).
- Loop back to Step 1 and watch the new exact-SHA pipeline run.

## 3. Seal Main (If Green)
- Confirm the successful run belongs to the latest pushed SHA on `main`.
- Report the green SHA and run URL. Do not create a PR, merge another branch, or add opportunistic follow-up changes.
> **Mainline delivery gate:** Read [`branch-safety.md`](branch-safety.md) before code, git, or CI actions. It defines delivery through Entire, including the automatic Trail route for protected `main`.
