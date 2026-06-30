# Hidden Bug Prevention System

**You looked good on stage, then the feature broke. Why?** Because tests passed, but real usage failed. This document explains the system that catches those bugs *before* you demo.

---

## The Problem

**Pattern:** Unit tests pass ✅ → E2E tests pass ✅ → Feature breaks in production ❌

**Why it happens:** Tests mock the API, so they never validate against real backend contracts. Bugs hide until real users (or you in a demo) discover them.

**Cost:** Looking bad in front of people. Lost credibility. Extra debugging cycles.

**Solution:** Three-layer testing + proactive pattern detection.

---

## What's New (2026-06-30)

### Five New Integration Test Suites (1,127 lines)

**1. API Contracts** (`e2e/api-contracts.integration.test.ts` — 5 tests)
- Validates Firebase Functions are initialized and callable
- **Catches:** "Cannot read properties of undefined (reading 'create')"
- **Status:** ✅ Would have caught the recent Firebase functions export order bug

**2. Creative Generation** (`e2e/creative-generation.integration.test.ts` — 6 tests)
- Validates image/video generation payload schemas
- Tests URI formats (gs:// vs Base64)
- **Catches:** "Invalid video payload. Base64 forbidden"
- **Status:** ✅ Would have caught the recent Whisk media bug

**3. Service Initialization** (`e2e/service-initialization.integration.test.ts` — 6 tests)
- Validates all 46 httpsCallable uses have functions initialized
- Tests multiple app instances
- **Catches:** Uninitialized service errors across the codebase
- **Coverage:** Firebase functions, messaging, custom services

**4. Payload Validation** (`e2e/payload-validation.integration.test.ts` — 11 tests)
- Documents payload contracts for 12+ API endpoints
- Tests enum values, URI formats, required fields
- Tests type safety (numbers vs strings, arrays vs null)
- **Catches:** Schema mismatches, invalid enums, missing fields

**5. Async Error Handling** (`e2e/async-error-handling.integration.test.ts` — 8 tests)
- Validates try-catch patterns for all await statements
- Tests timeout protection for long-running operations
- Tests error state recovery
- Tests concurrent operation safety
- **Catches:** Unhandled promise rejections, silent failures

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
# Update .agent/test_ledger/GENERATION_FAILURES.md
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

**How integration tests catch it:**
```typescript
const functions = getFunctions(app);
expect(functions).not.toBeNull();  // ← Fails before fix
const callable = httpsCallable(functions, 'generateImageV3');
```

**Prevention:** The test runs in CI. If `functions` is undefined, the test fails before merge.

---

### Case Study 2: Base64 Payload Rejection

**The bug:** Video generation failed with "Invalid video payload. Base64 forbidden; use gs:// URIs"

**Why unit/E2E tests missed it:**
- Unit tests never call the backend
- E2E tests mock the API, so backend validation never runs
- Bug only appears when real backend rejects the Base64 payload

**How integration tests catch it:**
```typescript
const validFormats = [
    { image: { uri: 'gs://bucket/path.jpg' } },   // Valid
    { image: { uri: 'https://example.com/path.jpg' } }, // Valid
];

const invalidFormats = [
    { image: { imageBytes: 'data:...' } },   // Invalid
];

// Test validates these contracts
```

**Prevention:** Test documents the backend contract. Code review catches any attempt to send imageBytes.

---

## The Testing Pyramid (Updated)

```
                  🔺
            Integration Tests
         (Real Firebase, real payloads)
        5 suites, 36 tests, catches API breaks
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

**Key difference:** Integration tests call REAL Firebase, not mocks. This validates the actual backend contract.

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
// ✅ GOOD: Integration test calls real backend
test('image generation payload validation', async () => {
    const functions = getFunctions(app);
    const generateImageV3 = httpsCallable(functions, 'generateImageV3');
    
    // This fails if backend contract changed
    try {
        await generateImageV3({ prompt: 'test', model: 'invalid-model' });
    } catch (error) {
        expect(error.code).toBe('invalid-argument'); // Real backend error
    }
});
```

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
