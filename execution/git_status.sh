#!/bin/bash
# git_status.sh - Robust git status and state detection.

set -e

# ANSI escape codes for coloring
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Checking git repository status...${NC}"

# Check if we are even in a git repo
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Not a git repository (or any of the parent directories)${NC}"
    exit 1
fi

# List porcelain status (machine readable)
CHANGES=$(git status --porcelain)
if [ -n "$CHANGES" ]; then
    echo -e "${YELLOW}Uncommitted changes detected:${NC}"
    echo "$CHANGES"
else
    echo -e "${GREEN}Working directory is clean.${NC}"
fi

# Detect rebase or merge state
if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
    echo -e "${RED}STATE: REBASE_IN_PROGRESS${NC}"
elif [ -f ".git/MERGE_HEAD" ]; then
    echo -e "${RED}STATE: MERGE_IN_PROGRESS${NC}"
elif [ -f ".git/CHERRY_PICK_HEAD" ]; then
    echo -e "${RED}STATE: CHERRY_PICK_IN_PROGRESS${NC}"
else
    echo -e "${GREEN}STATE: NORMAL${NC}"
fi

# Show current branch and hash
echo -n "Current Branch: "
git rev-parse --abbrev-ref HEAD
echo -n "Latest commit: "
git rev-parse --short HEAD
