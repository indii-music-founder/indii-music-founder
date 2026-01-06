#!/bin/bash
# git_pull_rebase.sh - Robust git pull with rebase and timeout handling.

REMOTE=${1:-origin}
BRANCH=${2:-main}

echo "Attempting to pull $BRANCH from $REMOTE with rebase..."

# Check if already in a rebase
if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
    echo "Error: Already in a rebase operation. Fix conflicts or use --abort first."
    exit 1
fi

git pull --rebase "$REMOTE" "$BRANCH"
