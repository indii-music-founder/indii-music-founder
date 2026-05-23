---
description: How to stress test the Security Agent in the browser
---

# Live Test: Security Agent

**Protocol for testing Security Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Security Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Ask the agent to run a compliance audit or security check on artist data.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns a security report with access logs and potential vulnerabilities.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
