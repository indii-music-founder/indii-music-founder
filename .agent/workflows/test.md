---
description: Automatically identify and run relevant tests based on the current context.
---

# Global Test Workflow (/test)

**Smart context test runner.**

## 1. Discovery

**Match Context -> Test Type:**

* `src/services/X.ts` -> `X.test.ts` or `find("*X*test*")`
* `src/modules/**/comp.tsx` -> `__tests__/comp.test.tsx`
* `packages/firebase/firestore.rules` -> `firestore.rules.test.ts`
* `execution/` -> `python3 -m pytest ...`

## 2. Execution Protocol

* **Unit (Vitest):** `npm run test -- [path]`
* **E2E (Playwright):** `npx vite optimize --config packages/renderer/vite.config.ts && npx firebase emulators:exec --only firestore "npm run test:e2e -- [path]"`
* **Python:** `python3 -m pytest [path]`
* **Department-Scoped:** `python3 execution/run_department_test.py [department] [options]` (e.g. `python3 execution/run_department_test.py marketing --unit-only`)
* **Audio System / MegaTestAudioLoop:** `python3 execution/run_department_test.py audio-analyzer` (aliases: `audio`, `audio-system`, `mega-test-audio`, `MegaTestAudioLoop`)

## 3. Triage

* **Fail?** Pipe to `test_failures.log`.
* **Analyze:** `python3 execution/triage_tests.py test_failures.log`

## 4. Fallback

* If found matched tests: **Run them**.
* Else: `npm run typecheck`.
> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
