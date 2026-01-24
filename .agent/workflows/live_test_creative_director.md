---
description: How to stress test the Creative Director module in the browser
---

# Live Test: Creative Director

**Protocol for testing Image Generation UI.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Creative Director** (Sidebar).

## 2. Trigger

* Input Prompt: "Futuristic neon city".
* Click **Generate**.

## 3. Verify

* **Visual:** Toast ("Image generated!") + Image appears/persists.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on `generateImage` endpoint.

## 4. Debug (If Fail)

* Check `src/modules/creative` or `src/services`.
* Fix & Refresh.
