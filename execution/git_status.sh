#!/bin/bash
# git_status.sh - Deterministic git status check for the 3rd-layer architecture.

set -e

echo "Checking git status..."
git status --porcelain

if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
    echo "STATE: REBASE_IN_PROGRESS"
else
    echo "STATE: CLEAN_OR_NORMAL"
fi
