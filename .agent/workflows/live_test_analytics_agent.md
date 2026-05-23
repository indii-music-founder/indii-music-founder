---
description: How to stress test the Intelligence Analytics Agent in the browser
---

# Live Test: Intelligence Analytics Agent

**Protocol for testing Intelligence Analytics Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Intelligence Analytics Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Request a demographic breakdown of the top streaming audience.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns data visualizations or charts of audience age and location.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
