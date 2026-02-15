---
description: Automatically identify and run relevant tests based on the current context.
---

# Global Test Workflow (/test)

**Smart context test runner.**

## 1. Discovery

**Match Context -> Test Type:**

* `src/services/X.ts` -> `X.test.ts` or `find("*X*test*")`
* `src/modules/**/comp.tsx` -> `__tests__/comp.test.tsx`
* `firestore.rules` -> `firestore.rules.test.ts`
* `execution/` -> `python3 -m pytest ...`

## 2. Execution Protocol

* **Unit (Vitest):** `npm run test -- [path]`
* **E2E (Playwright):** `npm run test:e2e -- [path]`
* **Python:** `python3 -m pytest [path]`

## 3. Triage

* **Fail?** Pipe to `test_failures.log`.
* **Analyze:** `python3 execution/triage_tests.py test_failures.log`

## 4. Fallback

* If found matched tests: **Run them**.
* Else: `npm run typecheck`.
