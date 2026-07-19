# /away — The Autonomous CI Monitor & Merge Loop

**Purpose:** Executes an autonomous loop to monitor the CI pipeline for the active branch, fix emerging issues, and eventually merge to main while the user is away.

## 1. Deploy the Browser Subagent
- Use the `invoke_subagent` tool to spawn the `browser` subagent with instructions to monitor the GitHub Actions pipeline for the current working branch.
- No need to poll; wait for the subagent's status report.

## 2. Fix Errors (If Red)
- If the subagent reports a failure, review the specific error logs provided.
- Automatically fix the code, run local validations (`typecheck`, `test`), and push the new commit.
- Loop back to Step 1 and have the browser subagent watch the new pipeline run.

## 3. Merge to Main (If Green)
- If the subagent reports a successful, fully green run, execute the merge process.
- Merge the active branch into `main` (either locally and push, or via PR).
- Clean up the local workspace and ensure `main` remains stable.
