---
description: How to stress test the DevOps Agent in the browser
---

# Live Test: DevOps Agent

**Protocol for testing DevOps Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **DevOps Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Request an infrastructure health check or deployment pipeline status.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns system status, recent logs, or CI/CD pipeline overview.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
