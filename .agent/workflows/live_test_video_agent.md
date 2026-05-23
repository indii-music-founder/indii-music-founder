---
description: How to stress test the Video Agent in the browser
---

# Live Test: Video Agent

**Protocol for testing Video Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Video Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Upload a raw video clip and request a color grading or trimming plan.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns video analysis and editing instructions.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
