---
description: How to stress test the Finance Accounting Agent in the browser
---

# Live Test: Finance Accounting Agent

**Protocol for testing Finance Accounting Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Finance Accounting Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Request a P&L (Profit and Loss) statement generation for the month.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns a structured financial statement with income and expenses.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
