# Pre-existing Test Infrastructure Issues

**Status:** Documented 2026-06-03 during PR #136 (Firebase initialization fixes)
**Related PR:** #136 — Firebase module-level initialization fix
**Branch:** codex/live-runtime-blockers

---

## Issue 1: gateway.integration.test.ts — Missing Storage Bucket Configuration

**Severity:** High (integration test blocks creative gateway verification)
**File:** `packages/firebase/src/functions/creative/__tests__/gateway.integration.test.ts`
**Error:** `Bucket name not specified or invalid. Specify a valid bucket name via the storageBucket option when initializing the app, or specify the bucket name explicitly when calling the getBucket() method.`

### Root Cause
The test setup in `packages/firebase/src/test/integration.setup.ts` initializes Firestore but does not configure Firebase Storage with a valid `storageBucket` option. The `gateway.ts` function calls `getStorage().bucket()` without arguments, which requires a default bucket to be configured.

### Fix Direction
1. Update `integration.setup.ts` to pass `storageBucket` in the `admin.initializeApp()` config
2. Use a test-safe bucket name (e.g., `test-bucket` or mock the storage service)
3. Verify the test setup provides both `db` (Firestore) and `storage` references
4. Rerun `npm test -- --run` to confirm gateway.integration.test.ts passes

### Files to Touch
- `packages/firebase/src/test/integration.setup.ts`
- `packages/firebase/src/functions/creative/__tests__/gateway.integration.test.ts` (if needed for mock assertions)

---

## Issue 2: AgentExecutor.integration.test.ts — GeneralistAgent Filter Error

**Severity:** High (agent pipeline test failure)
**File:** `packages/renderer/src/services/agent/specialists/GeneralistAgent.ts` (line 642)
**Error:** `TypeError: Cannot read properties of undefined (reading 'filter')`

### Root Cause
In `GeneralistAgent.execute()`, a chain call attempts to filter an undefined value. This appears to be in a message history or content extraction path where a variable is not initialized or a prior operation returned `undefined`.

### Fix Direction
1. Inspect `GeneralistAgent.ts` line 642 and surrounding context to identify which variable is undefined
2. Add null-coalescing or optional-chaining (`?.`) before the `.filter()` call
3. Add a guard clause to verify the value exists before filtering
4. Add a unit test for the edge case that triggers this error
5. Rerun `npm test -- --run` to confirm the test passes

### Files to Touch
- `packages/renderer/src/services/agent/specialists/GeneralistAgent.ts`
- `packages/renderer/src/services/agent/__tests__/AgentExecutor.integration.test.ts` (for test harness context)

---

## How to Proceed

1. Create a new branch off `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b fix/integration-test-infrastructure
   ```

2. Fix Issue 1 (Storage bucket) first — simpler and unblocks creative gateway tests

3. Fix Issue 2 (GeneralistAgent) — requires code inspection to identify the undefined chain

4. Run `npm test -- --run` after each fix to verify progress

5. Create a single PR with both fixes labeled `fix(testing): resolve integration test infrastructure failures`

---

## Additional Context

- **Commit:** `09f22b1f2` (Firebase initialization fix that exposed these issues)
- **ERROR_LEDGER Entry:** Added to `.agent/skills/error_memory/ERROR_LEDGER.md` under "2026-06-03 Pre-existing Integration Test Failures"
- **Token Status:** Created 2026-06-03 11:07 EDT — handoff at ~165k tokens used
