# /away — The Autonomous CI Monitor & Merge Loop

**Purpose:** Executes an autonomous loop for `main`: monitor the exact CI run produced by a direct push, fix observed failures, and repeat until `main` is green.

## 1. Deploy the Browser Subagent
- Require the current branch to be `main`, then monitor the GitHub Actions run for the exact pushed SHA.
- No need to poll; wait for the subagent's status report.

## 2. Fix Errors (If Red)
- If the subagent reports a failure, review the specific error logs provided.
- Fix only the root cause shown in the run logs, run local validations (`typecheck`, `test`), create one coherent follow-up commit, and push with `git push origin HEAD:main`.
- Loop back to Step 1 and have the browser subagent watch the new pipeline run.

## 3. Seal Main (If Green)
- Confirm the successful run belongs to the latest pushed SHA on `main`.
- Report the green SHA and run URL. Do not create a PR, merge another branch, or add opportunistic follow-up changes.
> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
