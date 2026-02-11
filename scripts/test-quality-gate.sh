#!/usr/bin/env bash
# =============================================================================
# TEST QUALITY GATE — Runs in CI on every PR that adds/modifies test files
# =============================================================================
# This script exists because AI agents bulk-generated ~500 broken tests that
# blocked CI for 5+ days. It enforces structural rules that prevent that from
# ever happening again.
#
# EXIT CODES:
#   0 = All checks passed
#   1 = Quality violation found — PR should not be merged
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

VIOLATIONS=0
WARNINGS=0

fail() {
  echo -e "${RED}FAIL:${NC} $1"
  VIOLATIONS=$((VIOLATIONS + 1))
}

warn() {
  echo -e "${YELLOW}WARN:${NC} $1"
  WARNINGS=$((WARNINGS + 1))
}

pass() {
  echo -e "${GREEN}PASS:${NC} $1"
}

echo "============================================"
echo "  TEST QUALITY GATE"
echo "============================================"
echo ""

# ── 1. Count new/modified test files in this PR ──────────────────────────────
# Compare against the base branch (main)
BASE_BRANCH="${GITHUB_BASE_REF:-main}"

NEW_TEST_FILES=$(git diff --name-only --diff-filter=A "origin/${BASE_BRANCH}...HEAD" 2>/dev/null \
  | grep -E '\.(test|spec)\.(ts|tsx)$' || true)
MODIFIED_TEST_FILES=$(git diff --name-only --diff-filter=M "origin/${BASE_BRANCH}...HEAD" 2>/dev/null \
  | grep -E '\.(test|spec)\.(ts|tsx)$' || true)

NEW_COUNT=$(echo "$NEW_TEST_FILES" | grep -c '.' 2>/dev/null || echo 0)
MOD_COUNT=$(echo "$MODIFIED_TEST_FILES" | grep -c '.' 2>/dev/null || echo 0)

echo "New test files:      $NEW_COUNT"
echo "Modified test files: $MOD_COUNT"
echo ""

# ── 2. BULK GENERATION CHECK ─────────────────────────────────────────────────
# If a single PR adds more than 5 new test files, flag it.
# This is THE rule that would have prevented the original disaster.
MAX_NEW_TESTS=5
if [ "$NEW_COUNT" -gt "$MAX_NEW_TESTS" ]; then
  fail "PR adds $NEW_COUNT new test files (max $MAX_NEW_TESTS per PR). Bulk test generation is not allowed."
  echo "     Split into smaller PRs with focused, reviewed tests."
fi

# ── 3. MOCK DENSITY CHECK ────────────────────────────────────────────────────
# Tests with excessive vi.mock() calls are likely testing mocks, not behavior.
MAX_MOCKS_PER_FILE=6

if [ -n "$NEW_TEST_FILES" ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    [ ! -f "$file" ] && continue
    MOCK_COUNT=$(grep -c 'vi\.mock\|jest\.mock' "$file" 2>/dev/null || echo 0)
    if [ "$MOCK_COUNT" -gt "$MAX_MOCKS_PER_FILE" ]; then
      fail "$file has $MOCK_COUNT mock calls (max $MAX_MOCKS_PER_FILE). Too many mocks = testing mocks, not behavior."
    fi
  done <<< "$NEW_TEST_FILES"
fi

# ── 4. MOCK-TO-ASSERTION RATIO ───────────────────────────────────────────────
# If mock setup lines outnumber assertion lines, the test is suspect.
if [ -n "$NEW_TEST_FILES" ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    [ ! -f "$file" ] && continue
    MOCK_LINES=$(grep -cE 'vi\.(mock|fn|hoisted|spyOn)|mockResolvedValue|mockReturnValue|mockImplementation' "$file" 2>/dev/null || echo 0)
    ASSERT_LINES=$(grep -cE 'expect\(|assert\.|toEqual|toBe|toThrow|toHaveBeenCalled|toContain|toMatch' "$file" 2>/dev/null || echo 0)

    if [ "$ASSERT_LINES" -eq 0 ]; then
      fail "$file has ZERO assertions. A test with no expect() is not a test."
    elif [ "$MOCK_LINES" -gt 0 ] && [ "$ASSERT_LINES" -gt 0 ]; then
      RATIO=$((MOCK_LINES / ASSERT_LINES))
      if [ "$RATIO" -gt 3 ]; then
        warn "$file has ${MOCK_LINES} mock lines vs ${ASSERT_LINES} assertion lines (ratio ${RATIO}:1). Consider simplifying."
      fi
    fi
  done <<< "$NEW_TEST_FILES"
fi

# ── 5. MERGE CONFLICT MARKERS ────────────────────────────────────────────────
# These should never be committed. Period.
CONFLICT_FILES=$(grep -rl '<<<<<<< \|>>>>>>> ' --include='*.ts' --include='*.tsx' src/ electron/ 2>/dev/null || true)
if [ -n "$CONFLICT_FILES" ]; then
  fail "Merge conflict markers found in source files:"
  echo "$CONFLICT_FILES" | while read -r f; do echo "     $f"; done
fi

# ── 6. TEST-SPECIFIC CODE IN PRODUCTION ──────────────────────────────────────
# Production code should never branch on test/mock conditions.
PROD_TEST_BRANCHES=$(grep -rnE "process\.env\.(NODE_ENV|VITEST|JEST)|\/mock\/|isTesting|isTest\b" \
  --include='*.ts' --include='*.tsx' \
  src/services/ src/modules/ src/core/ electron/handlers/ 2>/dev/null \
  | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '__tests__' \
  | grep -v 'node_modules' | grep -v '// test' | grep -v '\.d\.ts' || true)

if [ -n "$PROD_TEST_BRANCHES" ]; then
  warn "Possible test-specific branches in production code:"
  echo "$PROD_TEST_BRANCHES" | head -5 | while read -r line; do echo "     $line"; done
fi

# ── 7. FILE SIZE CHECK ───────────────────────────────────────────────────────
# Test files over 200 lines are usually doing too much.
MAX_TEST_LINES=200

if [ -n "$NEW_TEST_FILES" ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    [ ! -f "$file" ] && continue
    LINE_COUNT=$(wc -l < "$file" | tr -d ' ')
    if [ "$LINE_COUNT" -gt "$MAX_TEST_LINES" ]; then
      warn "$file is $LINE_COUNT lines (recommended max $MAX_TEST_LINES). Consider splitting into focused test files."
    fi
  done <<< "$NEW_TEST_FILES"
fi

# ── RESULTS ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
if [ "$VIOLATIONS" -gt 0 ]; then
  echo -e "  ${RED}FAILED: $VIOLATIONS violation(s), $WARNINGS warning(s)${NC}"
  echo "============================================"
  echo ""
  echo "Fix violations before merging. Warnings are advisory."
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo -e "  ${YELLOW}PASSED with $WARNINGS warning(s)${NC}"
  echo "============================================"
  exit 0
else
  echo -e "  ${GREEN}PASSED — All checks clean${NC}"
  echo "============================================"
  exit 0
fi
