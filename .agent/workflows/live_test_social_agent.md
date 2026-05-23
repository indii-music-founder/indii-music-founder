---
description: How to stress test the Social Media Agent in the browser
---

# Live Test: Social Media Agent

**Protocol for testing Social Media Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Social Media Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Request a 2-week content calendar for a new release on TikTok and Instagram.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns a day-by-day social media schedule with caption ideas.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
