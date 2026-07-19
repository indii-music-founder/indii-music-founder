# The Gauntlet - Standardized Verification Protocol

**Per AGENT_WORKFLOW_STANDARDS.md Section 7**

---

## Overview

The Gauntlet is a comprehensive verification suite that must be run before major releases and after architectural changes. It ensures code quality, model policy compliance, and system stability.

---

## When to Run the Gauntlet

**MANDATORY:**
- Before any production deployment
- After changes affecting > 5 files
- After modifying AI model configuration
- After changes to MembershipService or quota enforcement
- After modifying authentication or authorization logic

**RECOMMENDED:**
- After any significant feature addition
- Before creating a pull request
- After dependency updates

---

## How to Run

```bash
# From project root
./scripts/run-gauntlet.sh

# Optional live-service sweep
RUN_LIVE_GCP=true ./scripts/run-gauntlet.sh
```

---

## Verification Phases

### Phase 1: Build Verification
- TypeScript project references (`npm run typecheck`)
- Lint (`npm run lint`)
- Frontend API boundary guard (`npm run security:frontend-api-boundary`)
- Studio production build (`npm run build:studio`)

**Pass Criteria:** Zero compilation errors, successful build output

### Phase 2: Unit Tests
- Vertex backend routing tests
- Gemini image, video, billing, founder tier, and remote relay contract tests
- All Vitest unit tests

**Pass Criteria:** All tests pass with no failures

### Phase 3: E2E Stress Tests
- Mega stress specs (`e2e/mega-stress-test-v4.spec.ts` through `v12`)
- Current critical E2E specs for auth, navigation, FTUE, chaos, mobile remote, creative, video, media, and knowledge
- Optional live GCP API verification when `RUN_LIVE_GCP=true`

**Pass Criteria:** >90% success rate, no critical failures

### Phase 4: Model Policy Verification
- Scan backend, frontend, scripts, E2E, and workflows for invalid Vertex multi-region host construction
- Verify `us`/`eu` resource locations do not become invalid `us-aiplatform.googleapis.com` style hosts

**Pass Criteria:** No invalid `us-aiplatform.googleapis.com`, `eu-aiplatform.googleapis.com`, or `global-aiplatform.googleapis.com` host patterns found

---

## Interpreting Results

### All Tests Pass
```
╔══════════════════════════════════════════════════════════════╗
║  🎉 ALL TESTS PASSED - Ready for deployment!                 ║
╚══════════════════════════════════════════════════════════════╝
```
**Action:** Safe to deploy

### Tests Failed
```
╔══════════════════════════════════════════════════════════════╗
║  ⚠️  VERIFICATION FAILED - Fix issues before deployment      ║
╚══════════════════════════════════════════════════════════════╝
```
**Action:** Review failures, fix issues, re-run Gauntlet

---

## Remediation Steps

### Build Failures
1. Check `tsconfig.json` for strict mode issues
2. Run `npm run typecheck` locally to see full errors
3. Fix type errors before proceeding

### Unit Test Failures
1. Run `npm run test -- --run` to see detailed output
2. Check test file for specific failure
3. Fix the underlying code or update test expectations

### E2E Stress Test Failures
1. Ensure dev server is running (`npm run dev`)
2. Check Playwright configuration
3. Review test logs in `playwright-report/`
4. May indicate performance regression

### Vertex Host Violations
1. Search for the offending pattern: `rg "us-aiplatform|eu-aiplatform|global-aiplatform"`
2. Keep the Vertex resource location as `us`, `eu`, or `global`, but route those multi-region calls through `https://aiplatform.googleapis.com`
3. Use `packages/firebase/src/lib/vertexClient.ts` for backend Vertex client construction

---

## Adding New Tests

### Adding a Stress Test
1. Create `e2e/your-test.spec.ts`
2. Follow existing patterns in `e2e/stress-test-new-user.spec.ts` or the current `e2e/mega-stress-test-v*.spec.ts` files
3. Add to run-gauntlet.sh Phase 3 section

### Adding a Quota Test
1. Add test to the relevant workspace test, such as `packages/renderer/src/services/MembershipService.subscription.test.ts` or `packages/firebase/src/subscription/subscriptionDefaults.test.ts`
2. Test both within-limit and over-limit scenarios
3. Verify QuotaExceededError is thrown correctly

---

## Files Referenced

| File | Purpose |
|------|---------|
| `scripts/run-gauntlet.sh` | Main verification runner |
| `e2e/stress-test-new-user.spec.ts` | FTUE happy-path stress test |
| `e2e/multi-agent-swarm.spec.ts` | Multi-agent concurrency coverage |
| `e2e/mega-stress-test-v*.spec.ts` | Named mega stress suite |
| `packages/firebase/src/lib/vertexClient.test.ts` | Vertex endpoint host/location routing |
| `packages/firebase/src/functions/creative/gateway.test.ts` | Gemini image/video callable contract coverage |

---

## History

| Date | Change |
|------|--------|
| 2025-12-25 | Initial Gauntlet protocol created (Section 8 compliance) |

---

**Remember:** The Gauntlet is non-negotiable. A failed Gauntlet means no deployment.
