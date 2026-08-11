# Creative Generation Failure Ledger

**Purpose:** Track recurring failures in image/video generation. Identifies patterns so we fix root causes, not symptoms.

**Update Pattern:** Add new failures to the top. Link to commits that fix. Mark as RESOLVED when PR merges.

---

## RESOLVED Failures

### 2026-07-17 | Mobile Remote Stale Completion Overwrote Newer Work
- **Error:** A cancelled or superseded remote generation/playback operation could clear the timeout or UI state belonging to the next request.
- **Surface:** indiiCONTROLLER generation monitor and transport controls
- **Root Cause:** Async completion and timeout cleanup mutated shared refs without first proving that the completing operation still owned them.
- **Impact:** A newer command could lose its timeout, appear idle, or show the wrong playback state after an older promise settled.
- **Reproduction:** Start one operation, replace or cancel it, then allow the first timer or media promise to settle after the replacement begins.
- **Fix:** Track every timer, cancel on unmount or replacement, and guard cleanup/state updates with active-command, timer, media, and mounted identity checks.
- **Test Coverage:** `GenerationMonitor`, `AgentChat`, and `TransportBar` regression suites cover standby availability, timeout cleanup, rejected playback, and stale media completions.
- **Lesson:** Cleanup of shared async state must be conditional on ownership; unconditional `ref = null` is a race even when the original operation has already ended.

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

### 2026-08-11 | Annotation Tool Failure Reported as Completion
- **Error:** Image annotation returned no edited image, but direct dispatch recorded “Action complete” and the annotator showed no error.
- **Surface:** Inline Annotator on a generated chat image.
- **Root Cause:** `AgentService.dispatchToolCall()` treated a fulfilled `{ toolError, details }` result as success and swallowed thrown failures after writing a system message.
- **Impact:** Provider, configuration, validation, and network failures were invisible at the interactive annotation surface.
- **Reproduction:** Return a structured error from `edit_image_with_annotations` and select **Apply Edits**.
- **Fix:** Reject structured tool errors through the direct-dispatch Promise, validate annotations and instructions before the provider call, and render the retained error in an inline alert.
- **Test Coverage:** `AgentService.torture.test.ts`, `EditImageWithAnnotationsTool.test.ts`, and `ImageAnnotator.test.tsx` cover propagation, validation, visible recovery, and retained retry state.
- **Lesson:** Promise fulfillment is a transport fact, not a success receipt. Interactive tool adapters must inspect the result contract and propagate failure to the initiating UI.

---

## OPEN Failures

(None currently. All known failures resolved.)

---

## Codebase Pattern Audit (2026-06-30)

Comprehensive scan found **7 major patterns** that cause silent failures:

| Pattern | Count | Risk Level | Examples |
|---------|-------|-----------|----------|
| Module export order bugs | 4 | 🔴 Critical | `messaging`, `functions`, `identifyPlatform` |
| Base64/imageBytes sent to APIs | 15+ | 🔴 Critical | Whisk media in video generation |
| Unvalidated httpsCallable payloads | 46 | 🔴 Critical | generateImageV3, renderVideo, etc. |
| Unprotected async/await | 49+ | 🟠 High | Missing try-catch in useDirectGeneration |
| Firebase import tight coupling | 21 | 🟠 High | Direct Firebase imports in 21 modules |
| Async error chains broken | 15+ | 🟠 High | .then() without .catch() |
| String enum validation missing | 10+ | 🟡 Medium | model, aspectRatio, resolution comparisons |

**New test suites created to catch these:**
- `e2e/service-initialization.integration.test.ts` — 5 tests for module init order
- `e2e/payload-validation.integration.test.ts` — 7 tests for API payloads
- `e2e/async-error-handling.integration.test.ts` — 8 tests for error safety
- `scripts/detect-hidden-bugs.sh` — Weekly pattern scanner

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

Last update: 2026-08-11
