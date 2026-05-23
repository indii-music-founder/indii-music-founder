---
description: How to stress test the Publicist Agent in the browser
---

# Live Test: Publicist Agent

**Protocol for testing Publicist Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Publicist Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Ask the agent to draft a press release for an upcoming album.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns a formatted press release with a hook, quotes, and media contacts.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
