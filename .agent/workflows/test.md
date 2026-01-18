---
description: Automatically identify and run relevant tests based on the current context.
---

# Global Test Workflow (/test)

This workflow triggers a smart discovery process to find and execute tests relevant to your current work.

### 1. Context Analysis

First, determine which file you are currently working on or which area of the codebase is affected.

- Check `ADDITIONAL_METADATA` for the `Active Document`.
- Check for other open documents in `ADDITIONAL_METADATA`.
- If no specific file is active, ask the user: "What area or service would you like to test?"

### 2. Test Discovery

Search for tests corresponding to the identified context:

- **Specific File**: If you have an active file (e.g., `src/services/MyService.ts`), look for:
  - Co-located unit test: `src/services/MyService.test.ts` or `src/services/__tests__/MyService.test.ts`.
  - Related tests using `find_by_name`: Search for `*MyService*test*` or `*MyService*spec*`.
- **React Components**: If working in `src/modules/**/components/`, look for:
  - `src/modules/**/components/__tests__/Component.test.tsx`
- **Firebase Rules**: If `firestore.rules` is modified, use `firestore.rules.test.ts`.
- **E2E Tests**: Search the `tests/` and `e2e/` directories for relevant `.spec.ts` files.
- **Python Execution Layer**: If working in `execution/`, look for `ExecutionName_test.py` or similar.

### 3. Test Execution

Apply the correct test runner based on the file type:

- **Unit/Integration (Vitest)**:

  ```bash
  npm run test -- [path/to/test_file]
  ```

- **E2E (Playwright)**:

  ```bash
  npm run test:e2e -- [path/to/spec_file]
  ```

- **Python Tests**:

  ```bash
  python3 -m pytest [path/to/test_file]
  ```

### 4. Triage and Reporting

If tests fail:

1. Capture the output.
2. If the failure is complex, pipe the output to a temporary log file (e.g., `test_failures.log`).
3. Run the triage script to identify patterns:

    ```bash
    python3 execution/triage_tests.py test_failures.log
    ```

4. Summarize the failures and propose a fix.

### 5. Fallback Checklist

If no specific test is found:

- Run `npm run typecheck` to ensure no regressions.
- Search for tests in these common locations:
  - `src/services/**/__tests__`
  - `tests/features/`
  - `functions/src/__tests__`
