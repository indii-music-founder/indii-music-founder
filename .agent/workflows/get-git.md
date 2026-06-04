---
description: Git Repository Sync, Pre-Push Validation, and Background Cron Monitor. Runs git fetch/pull/rebase, runs typecheck & Vitest validation on ahead commits, pushes verified changes, and reschedules the dynamic polling backoff cron job.
---

# /get-git — The Git Repository Sync & Monitor Engine

**Runs the automated git synchronization cycle, verifies code stability, and manages the dynamic polling backoff schedule.**

This command keeps the local and remote repositories in sync while guaranteeing that pushes are fully validated and conventional commit standards are audited.

## 1. Execute the Synchronization Cycle
Run the monitor script to fetch the latest state, rebase remote changes, and evaluate local ahead commits:

```bash
node scripts/git_monitor_sync.js
```

## 2. Parse and Act on Results
Inspect the JSON output returned by the script:

### Case A — Sync Errors or Conflicts Detected (`syncError` is present)
- **STOP.** Do not push or proceed.
- If it is a rebase or stash-pop conflict, manually resolve conflicts and run `git rebase --continue` or `git rebase --abort`.

### Case B — Polling Interval Changed (`intervalChanged` is true)
If the dynamic polling interval has doubled (idle runs) or reset to 15 minutes (new changes):
1. Retrieve `currentTaskId` from the script output or [polling_state.json](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/.agent/checkpoints/polling_state.json).
2. If an active task exists, cancel/kill it using the `manage_task` tool:
   - Action: `kill`
   - TaskId: `<currentTaskId>`
3. Register the new Cron sequence using the `schedule` tool:
   - CronExpression: `<cronExpression>`
   - Prompt: `Verify git repository status, fetch origin, rebase local branch, clean up workspace conflicts, and run /issue sync to fix open issues.`
4. Update `currentTaskId` in [polling_state.json](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/.agent/checkpoints/polling_state.json) with the new Task ID returned by the scheduler.

## 3. Pre-Push Validation details
If there are commits ahead, `/get-git` automatically executes:
- `npm run typecheck`
- `npm test -- --run`
- `git push origin <current-branch>` (only if typecheck and tests pass).

If validation fails, the push is blocked to protect the remote build.

## 4. Issue Sync & Fix
**Safety Check:** Only proceed with Issue Sync if the git cycle completed successfully (no unresolved rebase/merge conflicts). Do not fix issues on top of a broken tree.

If safe to proceed, execute `/issue sync` to:
1. Fetch the latest open issues from GitHub.
2. Append them to `OPEN_ISSUES.md` (idempotently).
3. Automatically attempt to fix them.

## 5. Polish and Elevate (The `/better` Audit)
Once any issues are fixed (or before the final commit of the cycle), execute the `/better` workflow:
1. Audit the current changes and fixes from every angle (Performance, DevEx, Architecture).
2. Elevate the codebase to Platinum Quality Standards.
3. Apply any necessary micro-refactors or polish before the cycle concludes.

**Output the sync status (performed/idle), the next scheduled cron interval, and the status of any newly fixed issues.**
