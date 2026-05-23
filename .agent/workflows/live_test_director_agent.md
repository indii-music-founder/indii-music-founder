---
description: How to stress test the Director Agent in the browser
---

# Live Test: Director Agent

**Protocol for testing Director Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Director Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Request generation of a storyboard or video transition.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns storyboard assets or generated video transitions.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
