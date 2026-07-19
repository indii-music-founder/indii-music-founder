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

# Track results. Use assignment arithmetic so set -e does not exit when a
# post-increment expression evaluates to zero on the first pass/fail.
PASSED=0
FAILED=0

run_test() {
    local name=$1
    local cmd=$2
    echo "▶ Running: $name"
    if bash -lc "$cmd"; then
        echo "  ✅ PASS: $name"
        ((PASSED += 1))
    else
        echo "  ❌ FAIL: $name"
        ((FAILED += 1))
    fi
    echo ""
}

# ============================================================================
# PHASE 1: TypeScript & Build Verification
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 1: Build Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "TypeScript Compilation" "npm run typecheck"
run_test "Lint" "npm run lint"
run_test "Frontend API Boundary Guard" "npm run security:frontend-api-boundary"
run_test "Studio Build" "npm run build:studio"

# ============================================================================
# PHASE 2: Unit Tests
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 2: Unit Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Vertex Backend Routing Tests" "npm test -- --run packages/firebase/src/lib/vertexClient.test.ts packages/firebase/src/lib/image_generation.test.ts packages/firebase/src/functions/creative/gateway.test.ts"
run_test "Billing, Founder Tier, and Remote Relay Tests" "npm test -- --run packages/firebase/src/subscription/subscriptionDefaults.test.ts packages/renderer/src/services/billing/CostControlService.test.ts packages/renderer/src/services/agent/RemoteRelayService.test.ts"
run_test "Video Generation Contract Tests" "npm test -- --run packages/renderer/src/services/video/VideoGenerationService.ledger.test.ts packages/renderer/src/services/video/VeoPayloadValidation.test.ts packages/renderer/src/services/video/VeoTimeout.test.ts packages/firebase/src/__tests__/video_generation_metadata.test.ts packages/firebase/src/__tests__/video_generation_security.test.ts packages/firebase/src/__tests__/video_generation_pipeline.test.ts"
run_test "All Unit Tests" "npm run test -- --run"

# ============================================================================
# PHASE 3: E2E Stress Tests
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 3: E2E Stress Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Mega Shell Suite" "npx playwright test e2e/mega-stress-test-v4.spec.ts e2e/mega-stress-test-v11.spec.ts e2e/mega-stress-test-v12.spec.ts --project=chromium"
run_test "Real UI Suite" "npx playwright test e2e/stress-test-new-user.spec.ts e2e/chaos.spec.ts e2e/mobile-remote.spec.ts e2e/visual-qa.spec.ts e2e/knowledge.spec.ts e2e/the-librarian.spec.ts --project=chromium"

if [ "${RUN_LIVE_GCP:-false}" = "true" ]; then
    run_test "Live Backend Suite" "npx playwright test e2e/mega-stress-test-v10.spec.ts e2e/api-live-real-gcp.spec.ts --project=chromium"
else
    echo "▶ Skipping: Live Backend Suite"
    echo "  Set RUN_LIVE_GCP=true to run e2e/mega-stress-test-v10.spec.ts and e2e/api-live-real-gcp.spec.ts against live services."
    echo ""
fi

# ============================================================================
# PHASE 4: Model Policy Verification
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 4: Model Policy Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for invalid Vertex multi-region hosts. `us` and `eu` are valid Vertex
# resource locations, but they must use the unprefixed aiplatform.googleapis.com
# API host; `us-aiplatform.googleapis.com` is invalid.
echo "▶ Checking for invalid Vertex host construction..."
if rg -n "https://(us|eu|global)-aiplatform\\.googleapis\\.com|\\bus-aiplatform\\.googleapis\\.com" packages/firebase/src packages/renderer/src scripts e2e .github/workflows > /tmp/indii-invalid-vertex-hosts.txt 2>/dev/null; then
    echo "  ❌ FAIL: Invalid Vertex API host pattern found!"
    head -5 /tmp/indii-invalid-vertex-hosts.txt
    ((FAILED += 1))
else
    echo "  ✅ PASS: No invalid Vertex host patterns"
    ((PASSED += 1))
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
