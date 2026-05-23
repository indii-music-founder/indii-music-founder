---
description: How to stress test the Finance Tax Agent in the browser
---

# Live Test: Finance Tax Agent

**Protocol for testing Finance Tax Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Finance Tax Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Request an estimated quarterly tax deduction report for touring income.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns a tax projection with deductible expenses categorized.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
