# Hidden Bug Prevention System

**You looked good on stage, then the feature broke. Why?** Because tests passed, but real usage failed. This document explains the system that catches those bugs *before* you demo.

---

## The Problem

**Pattern:** Unit tests pass ✅ → E2E tests pass ✅ → Feature breaks in production ❌

**Why it happens:** Tests mock the API, so they never validate against real backend contracts. Bugs hide until real users (or you in a demo) discover them.

**Cost:** Looking bad in front of people. Lost credibility. Extra debugging cycles.

**Solution:** Three-layer testing + proactive pattern detection.

---

## Current Contract Test Surfaces (2026-07-26)

The original browser suites overclaimed what they proved: they simulated
payloads, retries, and errors without executing the production contracts. The
current `test:api` lane is intentionally narrower and truthful:

**1. Client callable construction** (`e2e/api-contracts.integration.test.ts`)
- Uses isolated Firebase app instances and proves the browser can construct
  callable references without a duplicate default-app failure.
- It does **not** invoke a live Function or treat placeholder credentials as
  backend validation.

**2. Protected creative client boundary** (`e2e/creative-generation.integration.test.ts`)
- Confirms the browser initializes Auth, Functions, Firestore, and Storage,
  and constructs only backend callables for image/video generation.

**3. Firebase service initialization** (`e2e/service-initialization.integration.test.ts`)
- Checks named-app isolation, callable construction, and conditional messaging
  support without leaking app state across tests.

**4. Shared creative request schemas** (`packages/firebase/src/shared/creative.integration.test.ts`)
- Executes the exact Zod schemas used by Firebase image, video, Omni, and TTS
  handlers; rejects data URLs, unbounded models/durations, and malformed
  identities.

**5. Real retry policy** (`packages/renderer/src/utils/async.test.ts`)
- Executes `fetchWithRetry` itself: Retry-After aware 429 behavior, bounded
  network retry, and no retry for non-transient 4xx responses.

An authenticated Auth/App Check/Functions/Firestore/Storage emulator lane is
still required before claiming end-to-end request admission. It is tracked in
ISSUE-1230; local construction or schema tests are not a substitute.

### Proactive Pattern Detector

**Tool:** `npm run detect:bugs` (or `bash scripts/detect-hidden-bugs.sh`)

**Scans for 7 patterns:**

| Pattern | Found | Risk | Test Suite |
|---------|-------|------|-----------|
| Service export order bugs | 1 | 🔴 Critical | API Contracts |
| Base64 sent to APIs | 63 instances | 🔴 Critical | Payload Validation |
| Unvalidated httpsCallable calls | 46 | 🔴 Critical | Service Init + Payload |
| Unprotected async/await | 495+ | 🟠 High | Async Error Handling |
| Firebase tight coupling | 21 modules | 🟠 High | Service Init |
| Broken async chains | 52 .then() | 🟠 High | Async Error Handling |
| String enum typos | 7 | 🟡 Medium | Payload Validation |

**Risk Score:** 146/100 → Requires action

---

## Usage

### Before Pushing Code

```bash
# Run all integration tests
npm run test:api

# Or run targeted tests
npm run test:contracts          # API contract validation
npm run test:generation         # Creative generation flows
npm run test:initialization     # Service init order
npm run test:payloads          # Payload schema validation
npm run test:async             # Error handling patterns
```

### Before Demoing a Feature

```bash
# Detect emerging patterns
npm run detect:bugs

# If risk score > 100, review the findings and add tests
```

### Weekly Maintenance

```bash
# Scan for pattern drift
bash scripts/detect-hidden-bugs.sh

# Add test cases for any new high-risk patterns
# Update .agent/test_ledger/OPEN_ISSUES_V2.md
```

### In CI Pipeline

Add to `.github/workflows/deploy.yml`:

```yaml
- name: Detect hidden bug patterns
  run: npm run detect:bugs

- name: Run all integration tests
  run: npm run test:api:ci
  if: success()
```

This runs BEFORE build, so pattern failures block deployment.

---

## How It Catches Real Bugs

### Case Study 1: Firebase Functions Export Order

**The bug:** Image generation failed with "Cannot read properties of undefined (reading 'create')"

**Why unit/E2E tests missed it:**
- Unit tests don't call `httpsCallable(functions, ...)`
- E2E tests mock the API call, so `functions` is never accessed
- Bug only appears at runtime when real code tries to use `functions`

**How the client-boundary test catches it:**
```typescript
const functions = getFunctions(app);
expect(functions).not.toBeNull();  // ← Fails before fix
const callable = httpsCallable(functions, 'generateImageV3');
```

**Prevention:** The test runs in CI. If `functions` is undefined, the test fails before merge. It does not prove a remote callable accepts a request; that needs the authenticated emulator lane.

---

### Case Study 2: Base64 Payload Rejection

**The bug:** Video generation failed with "Invalid video payload. Base64 forbidden; use gs:// URIs"

**Why unit/E2E tests missed it:**
- Unit tests never call the backend
- E2E tests mock the API, so backend validation never runs
- Bug only appears when real backend rejects the Base64 payload

**How the current contract tests catch it:**
```typescript
const result = GenerateVideoSchema.safeParse({
    prompt: 'A performance clip',
    firstFrameUri: 'data:image/png;base64,forged',
});
expect(result.success).toBe(false);
```

**Prevention:** Execute the shared Firebase schema and the gateway regression directly. An authenticated Functions-emulator test is still required to prove the deployed callable boundary.

---

## The Testing Pyramid (Updated)

```
                  🔺
        Contract / Boundary Tests
    (real shared schemas and client initialization)
       catches local API-contract regressions
              /                    \
             /                      \
            /  E2E Tests (Mocked)    \
       (UI interactions, routes)
        60+ tests, catches UI bugs
           /                        \
          /                          \
    Unit Tests (Pure Functions)
  (Logic, transforms, parsing)
   4,000+ tests, catches code bugs
_________________________________
```

**Key difference:** Local tests prove only the contract they actually execute. They must never be described as live backend validation. Authenticated emulator and production checks validate the deployed boundary separately.

---

## Anti-Patterns Now Documented

### Anti-Pattern 1: Mock Interception Hides Real Errors
```typescript
// ❌ BAD: This test passes even if backend rejects payload
test('image generation', async ({ authedPage: page }) => {
    await page.route('**/cloudfunctions.net/generateImage**', async route => {
        await route.continue(); // Mock returns success
    });
    await generateImage(); // Never fails, never validates
});
```

```typescript
// ✅ GOOD: Execute the exact shared Firebase request schema
test('image generation payload validation', () => {
    const result = GenerateImageSchema.safeParse({
        prompt: 'test',
        costReservationId: 'reservation-1',
        referenceUri: 'data:image/png;base64,forged',
    });
    expect(result.success).toBe(false);
});
```

For Auth/App Check/cost admission, run a dedicated authenticated emulator test;
never call production with placeholder credentials merely to make a test green.

### Anti-Pattern 2: Export Before Init
```typescript
// ❌ BAD: functions exported as null, then initialized later
export const functions = null;  // Line 87
// ... 100 lines of other code ...
functions = getFunctions(app);  // Line 267 in try-catch
```

```typescript
// ✅ GOOD: Export AFTER initialization
try {
    functions = getFunctions(app);
} catch (e) {
    logger.error('Failed to initialize Functions:', e);
}
export { functions };  // Export after init completes
```

### Anti-Pattern 3: Await Without Try-Catch
```typescript
// ❌ BAD: Unhandled promise rejection
const result = await generateImageV3(payload);
setResult(result); // Never runs if generateImageV3 throws
```

```typescript
// ✅ GOOD: Proper error handling
try {
    const result = await generateImageV3(payload);
    setResult(result);
} catch (error) {
    setError(error);
} finally {
    setIsGenerating(false);  // Always reset
}
```

---

## Maintenance Workflow

### When You Fix a Bug

1. **Add test case** to prevent regression
   ```bash
   # Example: Add to e2e/payload-validation.integration.test.ts
   test('Pod service rejects invalid product types', async () => { ... })
   ```

2. **Update the ledger**
   ```markdown
   # In .agent/test_ledger/GENERATION_FAILURES.md
   ### [Date] | [Bug Name]
   - Error: ...
   - Root Cause: ...
   - Fix: ... (commit hash)
   - Test Coverage: ...
   ```

3. **Verify detection**
   ```bash
   npm run detect:bugs  # Should show lower risk score
   ```

### When You Add a New API

1. **Document the contract**
   ```typescript
   // In e2e/payload-validation.integration.test.ts
   test('newApiFunction: validates required fields', async () => {
       const validPayload = { field1: 'value', field2: 123 };
       const invalidPayload = { field1: 'value' }; // missing field2
       expect(validPayload).toHaveProperty('field2');
   });
   ```

2. **Add to httpsCallable list** in service-initialization.integration.test.ts
   ```typescript
   const callableNames = [
       // ... existing
       'newApiFunction',  // ← Add here
   ];
   ```

3. **Run detector** to verify coverage
   ```bash
   npm run detect:bugs
   ```

---

## Metrics & Goals

### Current State (2026-06-30)
- ✅ 3 integration test suites created (36 tests)
- ✅ Pattern detector implemented
- ✅ 2 recent bugs would have been caught
- ⚠️ Risk score: 146 (HIGH)
- ⚠️ 63 Base64 instances (need audit)
- ⚠️ 495+ unprotected awaits (need gradual fixes)

### Goals (90 Days)
- Risk score: < 50
- All 46 httpsCallable uses have payload validation tests
- All 21 modules with Firebase coupling have init tests
- 0 Base64 sent to APIs (all converted to gs:// URIs)
- < 100 unprotected awaits (progressive cleanup)

### Measurement
```bash
# Weekly audit
npm run detect:bugs

# Trending the risk score
# If score increases: new patterns appearing (review them)
# If score stable: prevention working (maintain it)
# If score decreases: fixes landing (good momentum)
```

---

## References

- **Test suites:** `e2e/*.integration.test.ts`
- **Pattern detector:** `scripts/detect-hidden-bugs.sh`
- **Failure ledger:** `.agent/test_ledger/GENERATION_FAILURES.md`
- **Testing strategy:** `docs/TESTING_STRATEGY.md`
- **Recent fixes:** Commits `2ff496761` (functions init), `cc8a3eb71` (Whisk media)

---

## Next Steps

1. **This week:** Run integration tests in CI
2. **This sprint:** Audit the 63 Base64 instances, prioritize which to convert
3. **This month:** Add tests for the top 5 at-risk modules (creative, touring, marketing)
4. **Ongoing:** Weekly `npm run detect:bugs` to track patterns

**The goal:** Never again look bad on stage because a tested feature broke.
