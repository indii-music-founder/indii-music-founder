---
description: Adaptive git changes polling and backoff scheduler. Runs check_git_changes utility, updates scheduled task with appropriate cron interval, and verifies branch stability if changes are found.
---

# /wait — Adaptive Polling and Backoff Scheduler

Activates the adaptive polling check. It inspects git changes, scales the check interval up dynamically if the repository is idle (conserving resources), and resets back to high-gear (15 minutes) if any activity is detected.

## Step 1 — Run check_git_changes utility

Execute the helper script to analyze git status, staged changes, and local commits:

```bash
node scripts/check_git_changes.js
```

## Step 2 — Reschedule Polling Task

Based on the JSON output of the script:

1. **If `intervalChanged` is `true`:**
   - **Kill the old task** using `currentTaskId` from `.agent/checkpoints/polling_state.json` via the `manage_task` tool (`Action="kill"`).
   - **Schedule the new task** with the new `cronExpression` via the `schedule` tool:
     - `CronExpression`: `<cronExpression>`
     - `Prompt`: `"Scheduled Check: Check git status, build status, and see if there are any updates or tests to run."`
   - **Update the state file** (`.agent/checkpoints/polling_state.json`) with the new task ID:
     ```json
     {
       "currentIntervalMinutes": <nextIntervalMinutes>,
       "currentTaskId": "<newTaskId>",
       "consecutiveNoChangesRuns": <consecutiveNoChangesRuns>,
       "lastCheckTime": "<timestamp>"
     }
     ```

2. **If `intervalChanged` is `false`:**
   - Keep the existing task. No rescheduling needed.

## Step 3 — Post-Poll Check Action

- **If `hasChanges` is `true`:**
  - Snap the scheduler immediately back to **15 minutes** (which Step 2 handles).
  - Run the CI validation `npm run ci` to verify branch stability.
  - Alert the user of the new changes/commits.
- **If `hasChanges` is `false`:**
  - Continue to let the scheduler back off exponentially (15m -> 30m -> 1h -> 2h -> 4h -> 8h).
  - Provide a silent, clean summary of the next poll window.
