---
description: How to stress test the Screenwriter Agent in the browser
---

# Live Test: Screenwriter Agent

**Protocol for testing Screenwriter Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Screenwriter Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Ask the agent to format a raw story idea into a screenplay format.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns a correctly formatted script layout.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
