---
description: How to stress test the Tour Manager (Road) Agent in the browser
---

# Live Test: Tour Manager (Road) Agent

**Protocol for testing Tour Manager (Road) Agent workflows and capabilities.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Agent Workspace** or **Tour Manager (Road) Agent** (Sidebar).
* Ensure agent context is loaded.

## 2. Trigger

* Request a routing plan for a 10-city West Coast tour.
* Send the message and wait for execution.

## 3. Verify

* **Visual:** Toast ("Task completed!") + agent returns structured output in chat/canvas.
* **Functional:** Returns an itinerary with travel times, venues, and logistics.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent inference or tool execution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/agent` or the specific agent definition file.
* Check browser console for Genkit/API errors.
* Fix & Refresh.
