# Git Sync & Conflict Resolution Directive

## Goal

Synchronize the local repository with the remote `main` branch, ensuring all conflicts are resolved deterministically and the build remains stable.

## Required Inputs

- Remote branch name (default: `main`)
- Current status of local branch (dirty/clean)

## Tool Selection

- `git_status.sh`: Check for local changes.
- `git_pull_rebase.sh`: Attempt to pull with rebase.
- `resolve_conflicts.py`: Analyze and propose fixes for merge conflicts.

## Expected Outputs

- A clean branch synchronized with remote.
- All conflicts resolved.
- Build verification passed.

## Edge Case Handling

- **Rebase Hung:** If a git command hangs for more than 5 minutes, terminate and check `.git/rebase-merge`.
- **Merge Conflict Loop:** If conflicts reappear, perform a hard reset to the last known good state and re-apply changes in smaller batches.
