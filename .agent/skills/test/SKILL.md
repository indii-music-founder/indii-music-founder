---
name: Test Expert
description: Expert on finding, creating, and maintaining tests for the indiiOS codebase.
---

# Test Expert Skill

**Context-aware testing protocol for indiiOS.**

## 1. Context Awareness (The "Identify" Phase)
*   **Active File:** Check `ADDITIONAL_METADATA` for the currently active file. This is the primary "Item Under Test".
*   **Related Files:** If the active file is a data service (`*Service.ts`), the related test is likely `*Service.test.ts` or in `__tests__/`.
*   **UI Components:** If the active file is a React component (`*.tsx`), look for `__tests__/*.test.tsx`.

## 2. Test Discovery (The "Locate" Phase)
*   **Unit/Integration (Vitest):**
    *   **Pattern:** `*.test.ts`, `*.test.tsx`.
    *   **Locations:** Co-located with source (e.g., `src/services/Foo.ts` -> `src/services/Foo.test.ts`) OR in `__tests__` subfolder.
*   **End-to-End (Playwright):**
    *   **Pattern:** `*.spec.ts`.
    *   **Location:** `e2e/` directory.
*   **Firebase Functions:**
    *   **Location:** `functions/src/__tests__/`.

## 3. Test Execution (The "Run" Phase)
*   **Unit:** `npm run test -- [filename_keyword]` (Uses Vitest).
*   **E2E:** `npm run test:e2e -- [spec_filename]` (Uses Playwright).
*   **Type Check:** `npm run typecheck` (Always run this if no specific tests exist).

## 4. Test Creation (The "Build" Phase)
**Rule:** If a test does not exist for the modified code, **YOU MUST CREATE ONE.**

*   **Service Template (Vitest):**
    ```typescript
    import { describe, it, expect, vi } from 'vitest';
    import { MyService } from './MyService';

    describe('MyService', () => {
      it('should perform expected behavior', async () => {
        // Mock dependencies
        // Execute logic
        // Assert result
      });
    });
    ```
*   **E2E Template (Playwright):**
    ```typescript
    import { test, expect } from '@playwright/test';

    test('User Flow Description', async ({ page }) => {
      await page.goto('/');
      // Interact
      // Assert
    });
    ```

## 5. Maintenance & Updates
*   **New Tech:** If new libraries (e.g., GenAI SDKs) are introduced, update related tests to mock/verify these new interactions.
*   **Refactoring:** If code is refactored, run existing tests *immediately* to verify no regressions.
*   **Deprecation:** Remove tests for deleted features.

## 6. Auto-Triage
If tests fail:
1.  **Read Output:** Analyze the stack trace.
2.  **Fix Code:** If the code is buggy, fix it.
3.  **Fix Test:** If the test is outdated/wrong, update it.
4.  **Retry:** Run the specific test again until green.
