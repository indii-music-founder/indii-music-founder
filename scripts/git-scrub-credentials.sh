#!/bin/bash

# ============================================================================
# Git History Credential Scrub Script
# ============================================================================
# This script removes sensitive data from git history using BFG Repo-Cleaner.
# 
# WARNINGS:
# 1. This REWRITES git history - all commit hashes will change
# 2. All team members must re-clone the repo after this
# 3. Force push to remote is required
# 4. Backup your repo before running
#
# Prerequisites:
# - Java 8+ installed (required for BFG)
# - Write access to remote repository
# - No one is currently pushing to the repo
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║         Git History Credential Scrub Script                     ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# Configuration
# ============================================================================

# Patterns to remove (add more as needed)
PATTERNS_TO_REMOVE=(
    "qwertyuiop"                           # The exposed password
    "the.walking.agency.det@gmail.com"     # The exposed email
    # Add other secrets here if found in git history
)

# Files to check for accidental secrets
SENSITIVE_FILE_PATTERNS=(
    "*.env"
    "*.env.*"
    "*credentials*"
    "*secret*"
    "*.pem"
    "*.key"
)

# ============================================================================
# Pre-flight Checks
# ============================================================================

echo -e "${YELLOW}[1/6] Running pre-flight checks...${NC}"

# Check if we're in a git repo
if [ ! -d ".git" ]; then
    echo -e "${RED}Error: Not in a git repository root${NC}"
    exit 1
fi

# Check for Java
if ! command -v java &> /dev/null; then
    echo -e "${RED}Error: Java is required for BFG. Install Java 8+ first.${NC}"
    echo "  macOS: brew install openjdk"
    echo "  Ubuntu: sudo apt install default-jre"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}Error: You have uncommitted changes. Commit or stash them first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Pre-flight checks passed${NC}"

# ============================================================================
# Backup
# ============================================================================

echo ""
echo -e "${YELLOW}[2/6] Creating backup...${NC}"

BACKUP_DIR="../$(basename $(pwd))_backup_$(date +%Y%m%d_%H%M%S)"
echo "Backup location: $BACKUP_DIR"

cp -r . "$BACKUP_DIR"
echo -e "${GREEN}✓ Backup created${NC}"

# ============================================================================
# Download BFG if not present
# ============================================================================

echo ""
echo -e "${YELLOW}[3/6] Setting up BFG Repo-Cleaner...${NC}"

BFG_JAR="bfg-1.14.0.jar"
BFG_URL="https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"

if [ ! -f "$BFG_JAR" ]; then
    echo "Downloading BFG..."
    curl -L -o "$BFG_JAR" "$BFG_URL"
fi

echo -e "${GREEN}✓ BFG ready${NC}"

# ============================================================================
# Create patterns file
# ============================================================================

echo ""
echo -e "${YELLOW}[4/6] Creating patterns file...${NC}"

PATTERNS_FILE="patterns-to-remove.txt"
> "$PATTERNS_FILE"

for pattern in "${PATTERNS_TO_REMOVE[@]}"; do
    echo "$pattern" >> "$PATTERNS_FILE"
done

echo "Patterns to remove:"
cat "$PATTERNS_FILE"
echo ""
echo -e "${GREEN}✓ Patterns file created${NC}"

# ============================================================================
# Scan for secrets (dry run)
# ============================================================================

echo ""
echo -e "${YELLOW}[5/6] Scanning for secrets in history...${NC}"

echo "Checking for patterns in git history..."
for pattern in "${PATTERNS_TO_REMOVE[@]}"; do
    COUNT=$(git log -p --all -S "$pattern" 2>/dev/null | grep -c "$pattern" || true)
    if [ "$COUNT" -gt 0 ]; then
        echo -e "  ${RED}Found '$pattern': $COUNT occurrences${NC}"
    else
        echo -e "  ${GREEN}Pattern '$pattern': Not found (or already cleaned)${NC}"
    fi
done

# ============================================================================
# Confirmation
# ============================================================================

echo ""
echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  WARNING: This will rewrite git history!                        ║${NC}"
echo -e "${RED}║                                                                 ║${NC}"
echo -e "${RED}║  • All commit hashes will change                                ║${NC}"
echo -e "${RED}║  • Team members must re-clone after this                        ║${NC}"
echo -e "${RED}║  • You will need to force push                                  ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
read -p "Type 'SCRUB' to proceed, or anything else to abort: " CONFIRM

if [ "$CONFIRM" != "SCRUB" ]; then
    echo "Aborted."
    rm -f "$PATTERNS_FILE"
    exit 0
fi

# ============================================================================
# Run BFG
# ============================================================================

echo ""
echo -e "${YELLOW}[6/6] Running BFG Repo-Cleaner...${NC}"

# Replace text patterns
java -jar "$BFG_JAR" --replace-text "$PATTERNS_FILE" --no-blob-protection

# Clean up
echo ""
echo "Running git garbage collection..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Cleanup temp files
rm -f "$PATTERNS_FILE"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  History scrub complete!                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git log --oneline"
echo "  2. Force push: git push --force --all"
echo "  3. Force push tags: git push --force --tags"
echo "  4. Notify team to re-clone the repository"
echo "  5. Rotate the exposed credentials (IMPORTANT!)"
echo ""
echo "Backup location: $BACKUP_DIR"
echo ""
echo -e "${YELLOW}Remember: Anyone with a local clone still has the old history!${NC}"
echo -e "${YELLOW}Credential rotation is MANDATORY even after scrubbing.${NC}"
