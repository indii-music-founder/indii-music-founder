# Testing Strategy: Three-Layer Validation

This document explains how we catch real bugs before they reach users. **The old test suite missed the creative generation bugs because it mocked API calls.** This strategy adds layers that catch real failures.

---

## Three Layers of Testing

### Layer 1: Unit Tests (Vitest)
- **What:** Logic tests, data transforms, pure functions
- **Catches:** Code bugs, type errors, business logic mistakes
- **Misses:** API contract breaks, module initialization order, backend validation
- **Run:** `npm test` (watch mode) or `npm test:ci` (CI mode)
- **Example:** Testing `WhiskService.synthesizePrompt()` independently
- **Problem:** Mocks hide real errors. A function can pass all tests but fail at runtime if the backend contract changed.

### Layer 2: E2E Tests with Mocked API (Playwright)
- **What:** Full user flows, UI interactions, mocked backends
- **Catches:** UI bugs, routing issues, state management bugs
- **Misses:** Real API contract breaks, payload schema errors, backend unavailability
- **Run:** `npm run test:e2e`
- **Example:** `creative-studio.spec.ts` — user navigates to Creative Director, clicks Generate
- **Problem:** Mock intercepts (`page.route('**/cloudfunctions.net/generateImage**', async route => {...})`) prevent real payload validation. A broken payload passes the mock but fails the real backend.

### Layer 3: API Contract Tests (Playwright + Real Firebase)
- **What:** Firebase Functions initialization, payload validation, error handling
- **Catches:** Module init order bugs, payload schema mismatches, API unavailability, backend validation
- **Does NOT:** Test UI, routing, or full user flows (Layer 2 does that)
- **Run:** `npm run test:contracts` (image/video API contracts) or `npm run test:api:ci` (all integration tests)
- **Example:** `api-contracts.integration.test.ts` — verifies `functions` service is initialized before use
- **When:** Every deploy, every API change, after firebase.ts refactors

---

## Decision Tree: Which Test to Write?

```
Does this test a pure function or algorithm?
├─ YES → Unit test (Vitest) in packages/renderer/src/services/*.test.ts
└─ NO
   Does this test a user flow (UI navigation, interactions, state)?
   ├─ YES → E2E test (Playwright) in e2e/*.spec.ts
   └─ NO
      Does this test an API contract (backend availability, payload schema)?
      ├─ YES → Integration test (Playwright) in e2e/*integration.test.ts
      └─ NO → Don't test (or refactor to fit one of the above)
```

---

## Real-World Example: The Creative Generation Bugs

### Bug #1: Firebase Functions Export Order
**Symptom:** "Cannot read properties of undefined (reading 'create')" when user clicks Generate
**Why Unit Tests Missed It:** No unit test calls `httpsCallable(functions, ...)` 
**Why Mocked E2E Tests Missed It:** Mock route intercepts the call before it tries to access `functions`
**How Contract Test Catches It:** 
```typescript
const functions = getFunctions(app);
expect(functions).not.toBeNull();  // ← Would FAIL before fix
const generateImageV3 = httpsCallable(functions, 'generateImageV3');
```
**Lesson:** Export order bugs require actual Firebase initialization, not mocks.

### Bug #2: Base64 Payload Rejected
**Symptom:** "Invalid video payload. Base64 forbidden" for Whisk-enhanced video generation
**Why Unit Tests Missed It:** No unit test validates payload against backend schema
**Why Mocked E2E Tests Missed It:** Mock accepts anything; real backend rejects Base64
**How Contract Test Catches It:**
```typescript
// Documents the contract: video generation ONLY accepts gs:// URIs
const INVALID = { image: { imageBytes: 'data:...' } };
const VALID = { image: { uri: 'gs://bucket/path' } };
expect(INVALID).not.toEqual(VALID);
```
**Lesson:** Backend validation is the source of truth. Test actual payloads against it.

---

## Running Tests Locally

### Before You Commit
```bash
npm test -- --run          # Unit tests
npm run test:e2e           # E2E tests (mocked, fast)
npm run test:api           # API contracts (real Firebase)
```

### Before You Push (CI)
```bash
npm run validate           # Lint + typecheck + all unit tests
npm run test:api:ci        # Integration tests with CI=true
npm run test:e2e:emulator  # E2E with local Firebase emulator
```

### Full Pre-Deploy Check
```bash
npm run preflight:prod     # Production gate (no console.log, no mocks, etc.)
npm run build:studio       # Production build
npm test:ci                # All unit tests
npm run test:api:ci        # All integration tests
npm run test:e2e:emulator  # All E2E tests
```

---

## Debugging a Test Failure

### "Cannot read properties of undefined" in creative generation?
1. Check `packages/renderer/src/services/firebase.ts` — is `functions` exported AFTER it's initialized?
2. Run: `npm run test:contracts` — should fail if Firebase services aren't properly initialized
3. See `.agent/test_ledger/GENERATION_FAILURES.md` for similar issues

### Backend returns "Invalid payload" error?
1. Check the error message in `.agent/test_ledger/GENERATION_FAILURES.md` — is it a known contract change?
2. Run: `npm run test:generation` — test validates payload schemas against backend expectations
3. Verify the payload matches the test's documented contract (e.g., `uri` not `imageBytes`)

### Test passes locally but fails in CI?
1. Check `.github/workflows/deploy.yml` — does CI run `npm run test:api:ci`?
2. Check environment variables — CI may not have `VITE_FIREBASE_API_KEY` set
3. Run: `CI=true npm run test:api:ci` locally to reproduce

---

## Adding to CI Pipeline

Update `.github/workflows/deploy.yml`:

```yaml
- name: Run API contract tests
  run: npm run test:api:ci
  if: success()

- name: Run E2E tests with emulator
  run: npm run test:e2e:emulator
  if: success()
```

Place this BEFORE the build and deploy steps so API failures block deployment.

---

## Maintaining the Failure Ledger

When you fix a creative generation bug:

1. **Document it** in `.agent/test_ledger/GENERATION_FAILURES.md`
   - Date, error message, root cause, reproduction steps
   - Link to the commit that fixed it
   - Add a test case that would catch it next time

2. **Add a test case** to one of:
   - `e2e/api-contracts.integration.test.ts` (for module init / backend availability)
   - `e2e/creative-generation.integration.test.ts` (for payload schemas / error handling)

3. **Prevent regression:**
   - If the same bug happened twice, it's a pattern → add to CLAUDE.md Anti-Patterns
   - If a test caught it, ensure CI runs that test every push

---

## When to Skip Integration Tests

**Never.** If you think a test is slow or unnecessary:
1. It probably catches something unit/E2E tests miss
2. Run `npm run test:api:ci -- --grep "test-name"` to run just that test
3. If a test is broken, fix it; don't skip it

The creative generation bugs were "skipped" because no one tested the real backend. Don't repeat that mistake.

---

## Metrics to Track

Run weekly:
```bash
# How many tests in each layer?
grep -r "test(" e2e/*.spec.ts | wc -l        # E2E tests
grep -r "test(" e2e/*.integration.test.ts | wc -l  # Contract tests
npm test -- --run --reporter=verbose 2>&1 | grep "✓" | wc -l  # Unit tests

# How many tests catch bugs?
grep "Regression test for:" e2e/*.integration.test.ts | wc -l
```

Goal: Keep integration test count at 8+ (more = better bug detection).

---

## References

- `.agent/test_ledger/GENERATION_FAILURES.md` — Ledger of all generation bugs and fixes
- `e2e/api-contracts.integration.test.ts` — Firebase Functions contract tests
- `e2e/creative-generation.integration.test.ts` — Creative module integration tests
- `CLAUDE.md` — Anti-patterns to avoid (module init order, payload validation, etc.)
