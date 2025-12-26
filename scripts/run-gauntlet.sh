#!/bin/bash
#
# GAUNTLET - Standardized Verification Suite
# Per AGENT_WORKFLOW_STANDARDS.md Section 7
#
# Run this before major releases or after architectural changes.
#

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          🧪 THE GAUNTLET - Verification Suite                ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Running full verification protocol...                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Track results
PASSED=0
FAILED=0

run_test() {
    local name=$1
    local cmd=$2
    echo "▶ Running: $name"
    if eval "$cmd" > /dev/null 2>&1; then
        echo "  ✅ PASS: $name"
        ((PASSED++))
    else
        echo "  ❌ FAIL: $name"
        ((FAILED++))
    fi
    echo ""
}

# ============================================================================
# PHASE 1: TypeScript & Build Verification
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 1: Build Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "TypeScript Compilation" "npx tsc --noEmit"
run_test "Vite Build" "npm run build"

# ============================================================================
# PHASE 2: Unit Tests
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 2: Unit Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "MembershipService Tests" "npm run test -- --grep 'MembershipService' --run"
run_test "All Unit Tests" "npm run test -- --run"

# ============================================================================
# PHASE 3: E2E Stress Tests
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 3: E2E Stress Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Asset Loading Stress Test" "npx playwright test e2e/stress-test.spec.ts"
run_test "Load Simulation Test" "npx playwright test e2e/load-simulation.spec.ts"

# File Search RAG stress test (if exists)
if [ -f "e2e/file-search-stress.spec.ts" ]; then
    run_test "File Search RAG Stress Test" "npx playwright test e2e/file-search-stress.spec.ts"
fi

# ============================================================================
# PHASE 4: Model Policy Verification
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 4: Model Policy Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for forbidden model patterns
echo "▶ Checking for forbidden model patterns..."
if grep -rE "gemini-1\.|gemini-2\.0|gemini-pro-vision" src/ --include="*.ts" --include="*.tsx" | grep -v "FORBIDDEN" | grep -v "BANNED" | grep -v "ai-models.ts" > /dev/null 2>&1; then
    echo "  ❌ FAIL: Forbidden model patterns found!"
    grep -rE "gemini-1\.|gemini-2\.0|gemini-pro-vision" src/ --include="*.ts" --include="*.tsx" | grep -v "FORBIDDEN" | grep -v "BANNED" | grep -v "ai-models.ts" | head -5
    ((FAILED++))
else
    echo "  ✅ PASS: No forbidden model patterns"
    ((PASSED++))
fi
echo ""

# ============================================================================
# RESULTS
# ============================================================================
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    GAUNTLET RESULTS                          ║"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║  ✅ Passed: %-3d                                              ║\n" $PASSED
printf "║  ❌ Failed: %-3d                                              ║\n" $FAILED
echo "╠══════════════════════════════════════════════════════════════╣"

if [ $FAILED -eq 0 ]; then
    echo "║  🎉 ALL TESTS PASSED - Ready for deployment!                 ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    exit 0
else
    echo "║  ⚠️  VERIFICATION FAILED - Fix issues before deployment      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    exit 1
fi
