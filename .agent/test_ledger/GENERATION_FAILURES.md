# Creative Generation Failure Ledger

**Purpose:** Track recurring failures in image/video generation. Identifies patterns so we fix root causes, not symptoms.

**Update Pattern:** Add new failures to the top. Link to commits that fix. Mark as RESOLVED when PR merges.

---

## RESOLVED Failures

### 2026-06-30 | Firebase Functions Export Order Bug
- **Error:** `Cannot read properties of undefined (reading 'create')`
- **Surface:** Image generation failed in Creative Director
- **Root Cause:** `packages/renderer/src/services/firebase.ts` exported `functions` at line 117 before it was initialized at line 267
- **Impact:** 100% of image generation requests failed
- **Reproduction:** Click GENERATE on any image in Creative Director
- **Fix:** Moved export statement to occur after functions initialization (commit `2ff496761`)
- **Test Coverage:** `e2e/api-contracts.integration.test.ts` → "Firebase Functions service initializes and is callable"
- **Lesson:** Module export order matters. Integration tests that actually call the backend catch this.

### 2026-06-30 | Video Generation Base64 Payload Rejection
- **Error:** `Invalid video payload. Base64 forbidden; use gs:// URIs for reference media`
- **Surface:** Video generation failed when Whisk source media was included
- **Root Cause:** `packages/renderer/src/modules/creative/hooks/useDirectGeneration.ts:403` sent `imageBytes` (Base64) instead of uploading to storage and sending `uri` (gs://)
- **Impact:** All video generation with Whisk enhancements failed
- **Reproduction:** Generate video with Whisk modifier (e.g., "Cinematic Lighting")
- **Fix:** Upload Whisk media to Firebase Storage first, then send gs:// URIs (commit `cc8a3eb71`)
- **Test Coverage:** `e2e/creative-generation.integration.test.ts` → "video generation: no base64 URIs"
- **Lesson:** API contracts are strict. Backend validation is the source of truth; test against it.

---

## OPEN Failures

(None currently. All known failures resolved.)

---

## Pattern Analysis

### Anti-Pattern #1: Mock Tests Miss Backend Contracts
**Symptom:** Unit tests and mocked E2E tests pass. Feature fails in production.
**Root Cause:** Test mocks (line 14 in `e2e/creative-studio.spec.ts`) intercept HTTP calls before validation, hiding payload schema mismatches.
**Fix:** Added integration tests that call real Firebase Functions and validate error codes.
**Prevention:** Run `npm run test:integration` in CI before `npm run test:e2e`.

### Anti-Pattern #2: Module Init Order Bugs After Refactors
**Symptom:** Feature worked before refactor. Now undefined at runtime.
**Root Cause:** Refactors split code across files but don't maintain initialization order. Exports happen before init.
**Fix:** Use API contract tests to verify Firebase services are callable before any component tries to use them.
**Prevention:** Check `.agent/skills/error_memory/ERROR_LEDGER.md` for "module init" before refactoring Firebase setup.

### Anti-Pattern #3: Payload Schema Drift
**Symptom:** Unit tests assume old payload shape. Backend API changed but tests don't know.
**Root Cause:** Integration tests don't run against real backend. Schema drift goes undetected.
**Fix:** Document payload contracts in test comments. Run integration tests weekly against staging.
**Prevention:** Before shipping API changes (backend), update integration test expectations first.

---

## Test Execution

### Run All Tests
```bash
npm test                           # Unit tests (Vitest)
npm run test:e2e                   # E2E tests (Playwright, mocked)
npm run test:integration           # Integration tests (real Firebase calls)
npm run test:ci                    # All tests (unit → E2E → integration)
```

### Run Integration Tests Only
```bash
npx playwright test e2e/api-contracts.integration.test.ts
npx playwright test e2e/creative-generation.integration.test.ts
```

### Debug a Failure
```bash
# Enable logs
DEBUG=firebase:* npx playwright test e2e/api-contracts.integration.test.ts --headed

# Run single test
npx playwright test e2e/api-contracts.integration.test.ts -g "Firebase Functions"
```

---

## CI Integration

Add to `.github/workflows/deploy.yml`:

```yaml
- name: Run integration tests
  run: |
    npm run test:integration -- --run 2>&1 | tee integration-results.log
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
      echo "Integration tests failed. Check payload contracts."
      exit 1
    fi
```

---

## Ownership

- **Created:** 2026-06-30 (during Creative generation bug fixes)
- **Maintained by:** Whoever last modified `packages/renderer/src/services/image/` or `**/VideoGeneration**`
- **Review Cycle:** Weekly (look for new patterns)

Last update: 2026-06-30 12:40 UTC
