---
description: How to stress test the Finance Royalty Agent in the browser
---

# Live Test: Finance Royalty Agent

**Protocol for testing Finance Royalty Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Finance Royalty Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Upload a CSV of streaming data and request a royalty calculation.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns a royalty breakdown by platform and territory.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
