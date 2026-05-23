---
description: How to stress test the Merchandise Agent in the browser
---

# Live Test: Merchandise Agent

**Protocol for testing Merchandise Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Merchandise Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Request a merch drop strategy including unit costs and retail pricing.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns a cost breakdown and profit margin analysis for apparel.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
