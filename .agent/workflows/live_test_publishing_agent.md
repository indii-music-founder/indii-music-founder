---
description: How to stress test the Publishing Agent in the browser
---

# Live Test: Publishing Agent

**Protocol for testing Publishing Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Publishing Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Ask the agent to register a new song split (50% writer, 50% producer).
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns split sheet documentation and PRO registration steps.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
