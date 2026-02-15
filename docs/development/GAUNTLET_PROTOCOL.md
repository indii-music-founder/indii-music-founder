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

# Or with npm
npm run gauntlet  # (if configured in package.json)
```

---

## Verification Phases

### Phase 1: Build Verification
- TypeScript compilation (`tsc --noEmit`)
- Vite production build (`npm run build`)

**Pass Criteria:** Zero compilation errors, successful build output

### Phase 2: Unit Tests
- MembershipService quota enforcement tests
- All Vitest unit tests

**Pass Criteria:** All tests pass with no failures

### Phase 3: E2E Stress Tests
- Asset loading stress test (10 seeded images)
- Load simulation test (20 concurrent virtual users)
- File Search RAG stress test (if implemented)

**Pass Criteria:** >90% success rate, no critical failures

### Phase 4: Model Policy Verification
- Scan codebase for forbidden model patterns
- Verify AI_MODELS config uses only approved models

**Pass Criteria:** No `gemini-1.5`, `gemini-2.0`, or legacy model patterns found

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
2. Run `npx tsc --noEmit` locally to see full errors
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

### Model Policy Violations
1. Search for the offending pattern: `grep -r "gemini-1.5" src/`
2. Replace with `AI_MODELS.TEXT.AGENT` or `AI_MODELS.TEXT.FAST`
3. See MODEL_POLICY.md for approved models

---

## Adding New Tests

### Adding a Stress Test
1. Create `e2e/your-test.spec.ts`
2. Follow existing patterns in `e2e/stress-test.spec.ts`
3. Add to run-gauntlet.sh Phase 3 section

### Adding a Quota Test
1. Add test to `src/services/MembershipService.test.ts`
2. Test both within-limit and over-limit scenarios
3. Verify QuotaExceededError is thrown correctly

---

## Files Referenced

| File | Purpose |
|------|---------|
| `scripts/run-gauntlet.sh` | Main verification runner |
| `e2e/stress-test.spec.ts` | Asset loading stress test |
| `e2e/load-simulation.spec.ts` | Concurrent user simulation |
| `src/services/MembershipService.test.ts` | Quota enforcement tests |
| `src/core/config/ai-models.ts` | Model policy configuration |

---

## History

| Date | Change |
|------|--------|
| 2025-12-25 | Initial Gauntlet protocol created (Section 8 compliance) |

---

**Remember:** The Gauntlet is non-negotiable. A failed Gauntlet means no deployment.
