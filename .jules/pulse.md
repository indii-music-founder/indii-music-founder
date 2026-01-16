## 2024-05-23 - Video Workflow Error Handling
**Learning:** VideoWorkflow uses 'failed' status to stop the spinner but doesn't have a specific 'error' view component. It falls back to 'Director's Chair' (empty state) or resets the active video if one existed. This is good for recovery but might be confusing if the toast is missed.
**Action:** Ensure toast duration is sufficient or consider adding an inline error message in the empty state for better persistence.

## 2025-02-23 - Video Generation Loading Verification
**Learning:** To verify "Idle -> Loading" transition reliably in E2E, intercept the triggering network call (e.g. `triggerVideoJob`) and delay its response. This guarantees the UI stays in the "requesting" state long enough for assertions, independent of backend speed.
**Action:** Use this pattern for all future "Pulse" tests involving async actions.

## 2025-02-23 - Service Auth Bypass for E2E
**Learning:** Service-level auth checks (like in `VideoGenerationService`) prevent E2E tests from running with mock users unless a generic "Test Mode" bypass is implemented. Relying on hardcoded user IDs in production code is unsafe.
**Action:** Use `import.meta.env.DEV` or `window.__TEST_MODE__` combined with store state to allow bypass only in safe environments.
