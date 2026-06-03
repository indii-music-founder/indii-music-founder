# Mega Stress Test V9 - Regression Gauntlet

> **Target:** Validating the fixes applied in recent sweeping phases, specifically covering test infrastructure, runtime initialization, and live provider blockers.

## Test Routines

### Routine 1: Integration Test Infrastructure Stability
**Target Fix:** PR 138 / PR 137 (resolve integration test infrastructure failures)
**Steps:**
1. Run the integration test suite: `npm run test -- --run`
2. Ensure that tests do not fail due to mock or environment infrastructure issues.
3. Verify that test times are within expected boundaries (no infinite hangs).

### Routine 2: Firebase Runtime Initialization
**Target Fix:** PR 136 (defer initialization to runtime for test compatibility)
**Steps:**
1. Start the desktop app using `npm run desktop:dev` and web app using `npm run dev:web`.
2. Ensure no early crashes occur on boot due to Firebase instantiation errors.
3. Validate that Firebase tools (Auth, Firestore) initialize correctly when first accessed in the UI.

### Routine 3: Live Provider Blocker Handling
**Target Fix:** PR 135 / PR 133 (address live provider blocker handling)
**Steps:**
1. Access the features reliant on live providers.
2. Ensure that any missing or invalid provider keys do not hard-crash the application but instead gracefully handle the error.
3. Verify the fallback UI or toast notification accurately indicates the blocked provider state.

### Routine 4: UI Cleanup Verification
**Target Fix:** PR 126 (remove dead external noise texture)
**Steps:**
1. Navigate across main dashboard and modules (Creative Studio, Boardroom).
2. Inspect the console for any 404s related to noise textures or missing visual assets.
3. Confirm the visual rendering maintains the platinum standard aesthetic without the dead noise texture.

## Execution
This gauntlet should be executed by the `/mega-test` agent or a human tester. All results must be reported back to `OPEN_ISSUES.md`.
