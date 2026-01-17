#!/bin/bash
# git_pull_rebase.sh - Robust git pull with rebase and automatic state validation.

set -e

REMOTE=${1:-origin}
BRANCH=${2:-main}

# ANSI escape codes
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Initiating pull from ${REMOTE}/${BRANCH} with --rebase...${NC}"

# 1. Pre-flight check: Rebase in progress?
if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
    echo -e "${RED}FAILURE: Already in a rebase operation.${NC}"
    echo "Resolution: Manually fix conflicts and 'git rebase --continue', or 'git rebase --abort'."
    exit 1
fi

# 2. Pre-flight check: Uncommitted changes?
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}WARNING: Uncommitted changes detected.${NC}"
    echo "Stashing changes before pull..."
    git stash
    STASHED=true
fi

# 3. Pull with rebase
if git pull --rebase "$REMOTE" "$BRANCH"; then
    echo -e "${YELLOW}Pull successful.${NC}"
else
    echo -e "${RED}PULL FAILED: Conflicts likely detected.${NC}"
    echo "Current state: $(git status -s)"
    exit 1
fi

# 4. Pop stash if we stashed
if [ "$STASHED" = true ]; then
    echo "Popping stashed changes..."
    git stash pop || echo -e "${YELLOW}Stash pop failed (conflicts!). Manual resolution required.${NC}"
fi

echo -e "${YELLOW}Git Operation Complete.${NC}"
