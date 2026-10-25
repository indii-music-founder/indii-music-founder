---
description: Read-only repository state and CI monitor. Repository delivery runs through reviewed task PRs under branch-safety.md.
---

> [!IMPORTANT]
> **CRITICAL ISSUE TRACKING RULE:**
> You MUST ONLY log issues in `.agent/test_ledger/OPEN_ISSUES_V2.md`. Do NOT create new or standalone markdown files (like BROWSER_ISSUES.md or issue-specific files) for issues.

# /get-git — The Git Repository Sync & Monitor Engine

**Runs the automated git synchronization cycle, verifies code stability, and manages the dynamic polling backoff schedule.**

This command keeps the local and remote repositories in sync while guaranteeing that pushes are fully validated and conventional commit standards are audited.

## 1. Execute the Synchronization Cycle

Run the read-only monitor script to fetch `origin/main` and report branch divergence and CI state:

```bash
node scripts/git_monitor_sync.js
```

**Legacy cleanup is report-only:** List leftover worktrees and branches, but never remove or delete them without the user's explicit authorization for the exact targets.

## 2. Parse and Act on Results

Inspect the JSON output returned by the script:

### Case A — Sync Errors or Conflicts Detected (`syncError` is present)

- **STOP.** Do not push or proceed.
- If the task branch is behind, divergent, or dirty with unrelated work, report the exact state. Never start a rebase automatically.

### Case B — Polling Interval Changed (`intervalChanged` is true)

If the dynamic polling interval has doubled (idle runs) or reset to 15 minutes (new changes):

1. Retrieve `currentTaskId` from the script output or [polling_state.json](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/.agent/checkpoints/polling_state.json).
2. If an active task exists, cancel/kill it using the `manage_task` tool:
   - Action: `kill`
   - TaskId: `<currentTaskId>`
3. Register the new Cron sequence using the `schedule` tool:
   - CronExpression: `<cronExpression>`
   - Prompt: `Verify repository status without mutation, fetch origin/main, report divergence or unrelated dirty work, and monitor exact-SHA CI.`
4. Update `currentTaskId` in [polling_state.json](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/.agent/checkpoints/polling_state.json) with the new Task ID returned by the scheduler.

## 3. Delivery handoff

`/get-git` never pushes or merges. Use `/ci-validate` and `/end` for local validation and PR publication under [`branch-safety.md`](branch-safety.md).

## 4. Issue Sync & Fix

**Safety Check:** Only proceed with Issue Sync if the git cycle completed successfully (no unresolved rebase/merge conflicts). Do not fix issues on top of a broken tree.

If safe to proceed, execute `/issue sync` to:

1. Fetch the latest open issues from GitHub.
2. Append them to `.agent/test_ledger/OPEN_ISSUES_V2.md` (idempotently).
3. Automatically attempt to fix them.

## 5. Post-Push CI Health Check

**Safety Check:** After pushing code or verifying repo status, you MUST check the health of the GitHub Actions CI pipeline. We do not tolerate red 'X' marks on `main`.

1. Use the GitHub CLI (`gh run list --status failure --branch main`) or MCP tools to check for any recent failed CI workflow runs.
   - **Fallback:** If `gh run list` fails due to an authentication error (e.g. `HTTP 401: Bad credentials`), you MUST fall back to running the full test suite locally (`npm test -- --run` and `npm run typecheck`) to ensure the codebase is green.
2. If a failed run is detected (or local tests fail), fetch the logs to diagnose the failure.
3. Automatically initiate a fix cycle to resolve the CI failure, verify locally, and push the fix to restore the green checkmark.

**Output the sync status (performed/idle), the next scheduled cron interval, and the status of any newly fixed issues or CI pipelines.**

> **Note on polish:** `/get-git` is a sync-and-validate utility — do NOT run `/better` here. Polish belongs to `/go` (per task) and `/end` (final pass).
> **Protected main delivery gate:** Before any code, git, CI, or push action, read and obey [`branch-safety.md`](branch-safety.md). Deliver through a focused branch and reviewed PR; direct pushes to `main` are prohibited.
