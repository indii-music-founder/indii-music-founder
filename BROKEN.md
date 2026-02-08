# Known Broken Items

> **Living document** tracking known issues, incomplete implementations, and technical debt.
> Updated: 2026-02-08
>
> Cross-reference with `.agent/skills/error_memory/ERROR_LEDGER.md` for documented fixes.

---

## Critical: CI/Test Infrastructure

### 1. Incomplete `vi.mock` exports cause test hangs
**Status:** FIXED (2026-02-08)
**Pattern:** Tests that mock `@/core/config/ai-models` without including `APPROVED_MODELS` cause downstream modules to fail at import time. Since `ai-models.ts` runs `validateModels()` on load, missing exports can cascade into unresolved promises that hang the test runner.

**Files that were affected:**
- `src/modules/legal/LegalDashboard.test.tsx`
- `src/services/video/VideoService.test.ts`
- `src/services/agent/tools/__tests__/StandardGrammar.test.ts`
- `src/services/agent/tools/__tests__/SocialTools.test.ts`
- `src/services/agent/definitions/LicensingAgent.test.ts`
- `src/services/rag/ragService.test.ts`

**Fix pattern:**
```typescript
vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: { /* your mock */ },
    APPROVED_MODELS: {
        TEXT_AGENT: 'mock-model', TEXT_FAST: 'mock-model',
        IMAGE_GEN: 'mock-model', IMAGE_FAST: 'mock-model',
        AUDIO_PRO: 'mock-model', AUDIO_FLASH: 'mock-model',
        VIDEO_GEN: 'mock-model', BROWSER_AGENT: 'mock-model',
        EMBEDDING_DEFAULT: 'models/embedding-001'
    },
    validateModels: () => {},
    ModelIdSchema: { parse: (v: string) => v }
}));
```

### 2. `vi.unmock()` causes cascading module loads
**Status:** FIXED (2026-02-08)
**Pattern:** Using `vi.unmock('./registry')` after `vi.mock()` loads the REAL agent registry, which triggers lazy-loading of real `GeneralistAgent`, which imports Firebase/AI services, which hang in CI.

**Rule:** NEVER use `vi.unmock()` in tests. Always provide complete mocks.

### 3. `firebase/auth` mock missing `onAuthStateChanged` on auth object
**Status:** FIXED (2026-02-08)
**Pattern:** `MetadataPersistenceService` calls `auth.onAuthStateChanged(...)` as a method on the auth object (from `getAuth()`). Tests that mock `getAuth()` must include `onAuthStateChanged` on the returned object, not just as a standalone export.

**Fix pattern:**
```typescript
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({
        currentUser: { uid: 'test-user' },
        onAuthStateChanged: vi.fn(() => () => {})  // MUST be on the auth object
    })),
    onAuthStateChanged: vi.fn(),  // Also as standalone export
    // ...other exports
}));
```

### 4. `--no-file-parallelism` forced sequential test execution
**Status:** FIXED (2026-02-08)
**What:** CI workflow used `--no-file-parallelism` which forced 434 test files to run one at a time, hitting the 30-minute timeout.

---

## Warning: Pre-existing Test Failures

### 5. `PromptArea.test.tsx` — Hook timeout with `vi.resetModules()`
**Status:** FIXED (2026-02-08)
**What:** Used `vi.resetModules()` + dynamic `import('zustand')` in `beforeEach`, creating race conditions. The hook timed out at 10s.
**Fix:** Rewrote to use `vi.hoisted()` for store state and `useShallow` mock.

### 6. `VideoGenerationService.schema.test.ts` — Missing `serverTimestamp` export
**Status:** KNOWN, NOT BLOCKING
**What:** `MetadataPersistenceService.save()` calls `serverTimestamp` from `firebase/firestore`, but the test's mock doesn't provide it. The error is caught internally and the test still passes.

### 7. `distribution_sandbox.security.test.ts` — 6 pre-existing failures
**Status:** KNOWN, NEEDS INVESTIGATION
**What:** Security sandbox tests for distribution handler have assertion mismatches. Not caused by CI changes — these are pre-existing.

---

## Info: Lint Warnings (Non-blocking)

### 8. TypeScript `@typescript-eslint/no-explicit-any` warnings (11 total)
**Status:** KNOWN, LOW PRIORITY
**Files:** `e2e/assets-drawer.spec.ts`, `e2e/agent-flow.spec.ts`, `docs/verification/verify_changes.ts`, `agents/creative-director/src/index.ts`
**Impact:** Warnings only (ESLint rule is `warn`, not `error`). Will not block CI.

---

## Architectural Risks

### 9. `ProactiveService` event listener duplication
**Status:** PREVIOUSLY FIXED (commit 461f543a), MONITOR
**What:** `ProactiveService` was adding event listeners without cleanup, causing memory leaks that prevented test teardown.

### 10. `AgentService` interaction timeout (60s)
**Status:** PREVIOUSLY FIXED (commit cfec778e), MONITOR
**What:** `AgentZeroService` had a 60-second interaction timeout that could cause test hangs if not properly mocked in `src/test/setup.ts`.

---

## How to Add New Items

When you discover something broken:
1. Add it to this file under the appropriate section
2. Include: Status, What, File(s), Fix pattern (if known)
3. If you fix it, update status to `FIXED` with date
4. Cross-reference with `ERROR_LEDGER.md` if the fix involves an error pattern
