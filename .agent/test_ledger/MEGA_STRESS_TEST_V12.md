# Mega Stress Test Plan v12.0 (Main-Process & Firebase Function Integrity)

This test protocol verifies the robustness of the recent main-process IPC handlers, Firebase Cloud Functions validation, Firestore security rules isolation, Zustand state update loop optimizations, and mobile remote heartbeats.

## Section 1: Webhook & Cloud Function Security (ISSUE-367–370, ISSUE-376)
Routine 121. **Webhook Queue & Dispatcher Validation (ISSUE-367, ISSUE-368):** Verify that webhook events are enqueued with a valid `nextRetry` set to the current time, and that `processWebhookQueue` successfully resolves user document IDs by referencing the explicitly stored `userId` rather than splitting a generated `webhookId`.
Routine 122. **createWebhook Authentication & verifySignature Protection (ISSUE-369, ISSUE-370):** Trigger a request to the `createWebhook` endpoint without an ID token, verifying it is rejected (401). Send a request to a signed webhook endpoint with matching vs mismatching signature buffer lengths, ensuring `timingSafeEqual` does not throw an error on different lengths and returns a clean 401/403.
Routine 127. **Handoff Endpoint Security & Rate Limiting (ISSUE-376):** Attempt to redeem an invalid handoff token format (e.g., non-64-hex string or too short). Verify that `redeemHandoffCode` rejects the payload with a validation error, and check that rate limiting prevents flooding the endpoint.

## Section 2: Firestore & State Architecture Isolation (ISSUE-371–373, ISSUE-375, ISSUE-391, ISSUE-392)
Routine 123. **Firestore Rule Isolation & Seating (ISSUE-371, ISSUE-372):** Authenticate as User A and attempt to read or write to User B's documents in `agent_traces`, `agent_tasks`, `distribution_audit`, or `upc_pool` collections. Verify that Firestore security rules reject all cross-user read/write attempts with a permission error.
Routine 124. **Store Module-Switch Purity & Tear-down (ISSUE-373, ISSUE-391):** Switch modules in the UI. Check that the previous module's active subscriptions are cleanly disposed of by verifying that `appSlice.ts` captures the outgoing module before state commits. Verify that `_navigationHistory` is updated via copy-on-write without in-place array mutation.
Routine 125. **Zustand 5 Render Loops & Dialog Purity (ISSUE-375, ISSUE-392):** Navigate to the Founders Portal. Verify that Zustand 5 does not trigger an infinite re-render loop ("maximum update depth") by ensuring selectors are wrapped in `useShallow`. Verify that changing modules does not invoke synchronous `window.confirm` dialogs that freeze the renderer.

## Section 3: Agent Resiliency & Bridge Hardening (ISSUE-374, ISSUE-382, ISSUE-393, ISSUE-394)
Routine 126. **Agent Import Purity & Null Guards (ISSUE-374, ISSUE-393, ISSUE-394):** Trigger a simulated module import failure during agent execution. Verify that `AgentService` does not dereference a null store and that `isProcessing` is cleanly reset in a `finally` block, leaving the agent operational for subsequent message requests.
Routine 129. **Python Bridge Path Traversal Prevention (ISSUE-382):** Invoke the Python bridge main IPC handler with a path traversal argument (e.g., `../`). Verify that the bridge rejects the request, validating the path segment, and ensures execution stays confined to the designated script directory.

## Section 4: Mobile Remote Heartbeat & Connectivity (ISSUE-377, ISSUE-378, ISSUE-380)
Routine 128. **Mobile Heartbeat & Navigation Purity (ISSUE-377, ISSUE-378, ISSUE-380):** Connect a mobile remote instance. Navigate between modules on the desktop. Verify that the desktop does not broadcast transient `online:false` updates during navigation, and check that the mobile UI remains responsive and automatically flags the desktop as offline if the timestamp heartbeat is older than 15s.
Routine 130. **Mobile Command Queue Reliability (ISSUE-379):** Connect the mobile remote. Send a command while the relay is busy. Verify that the command is queued rather than dropped, and is executed after the current command completes.

## Pass/Fail Criteria
| Result | Definition |
|--------|------------|
| ✅ PASS | Secure endpoint returns expected rejection, Zustand 5 does not crash, IPC methods succeed, and heartbeats remain stable. |
| ⚠️ PARTIAL | System functions but prints console warnings or handles edge-cases sluggishly. |
| ❌ FAIL | Path traversal succeeds, rules are bypassed, render loop crashes page, or IPC methods throw unhandled exceptions. |

## Execution Notes
- Run with the Browser Subagent / Playwright tests.
- Verify security endpoints under both emulator and staging environments.
- Console errors or security leaks are disqualifying.
