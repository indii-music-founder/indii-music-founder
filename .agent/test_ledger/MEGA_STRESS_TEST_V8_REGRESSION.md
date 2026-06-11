# Mega Stress Test Plan v8.0 (Anti-AI Slop & Type-Safety Hardening)

Building upon the previous Gauntlet (v7.0), Version 8 introduces specific targeted tests for the newly integrated Anti-AI Slop mechanisms and typescript stability fixes across Boardroom UI elements. 

The goal of this run is to ensure no regression in the core workflow rendering, and that our automated anti-slop rules effectively intercept placeholder responses.

---

## Section 1: Type-Safety Regression & Rendering (ISSUE-SWEEP-UI)

101. **Boardroom Participant Selector Rendering:** Launch the application in dev mode (`npm run dev:web`). Open the Boardroom module. Check the browser console. Verify that `ParticipantSelector` loads perfectly with **zero React `key` warnings** and **zero fragment mounting errors**. Hover over seated agents and verify that Tooltips render cleanly without jitter or `z-index` collision.

102. **Dashboard Empty State Rendering:** Navigate to the Dashboard while simulating a new account (empty workspace). Open the browser console. Verify there are **zero `invalid element type` warnings** or `any` type coercions causing React to complain. The icons within the suggestion grid must render consistently.

---

## Section 2: Anti-AI Slop Mechanics (HUNTER-001)

103. **Agent Workflow Slop Interception:** Run a complex task via the `/go` loop (e.g. "Build me a fully complete React component with 5 sub-files"). Have the test agent artificially force a simulated `// ... rest of code` response. Verify that the `health_audit` and Anti-AI Slop systems intercept the payload and reject the generation, rather than silently committing it to the repo.

104. **Sentry/CodeRabbit Sweep Stability:** Trigger the `/issue-sweep` slash command from a dirty working tree containing a deliberate trailing space or unused import. Verify that the workflow safely stashes the branch, fixes the lint warning, validates `typecheck` / `lint`, and generates a clean commit log without dropping work.

---

## Section 3: Baseline Regression (V7 Gauntlet)

105. **Full System Test Integration:** Execute the standard V7 integration paths (Boardroom context transfer, Marketing Omni agent dispatch, Creative Canvas UI). 
    * Verify that the context handshake (ISSUE-033) continues to persist assets across modules.
    * Verify that concurrent agent queries do not trigger the dynamic import race condition (ISSUE-034).

## Pass/Fail Criteria
| Result | Definition |
|--------|------------|
| ✅ PASS | All steps execute smoothly with 0 console errors and 0 slop patterns. |
| ⚠️ PARTIAL | Feature works but with minor degradation (e.g., slower, console warning). Document and monitor. |
| ❌ FAIL | Any UI crash, timeout, console warning, or un-intercepted slop token triggers. |

## Execution Notes
- Run against both the live production build and the local dev build.
- The `typecheck` command must succeed locally with 0 errors before considering Section 1 passed.
