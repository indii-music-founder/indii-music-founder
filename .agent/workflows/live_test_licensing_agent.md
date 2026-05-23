---
description: How to stress test the Sync Licensing Agent in the browser
---

# Live Test: Sync Licensing Agent

**Protocol for testing Sync Licensing Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Sync Licensing Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Request a sync pitch for a moody indie pop song for a TV drama.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns a targeted pitch email and metadata keywords for music supervisors.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
