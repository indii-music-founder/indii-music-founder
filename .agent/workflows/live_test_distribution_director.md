---
description: How to stress test the Distribution Director module in the browser
---

# Live Test: Distribution Director

**Protocol for testing Distribution Waterfalls and Release submission.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Distribution Director** (Sidebar).

## 2. Trigger

* Fill out a mock release form (Title, Audio, Artwork).
* Click **Run Waterfall** or **Submit Release**.

## 3. Verify

* **Visual:** Toast ("Release submitted to waterfall!") + status updates to processing/distributed.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on distribution endpoints.

## 4. Debug (If Fail)

* Check `src/modules/distribution` or `src/services/distribution`.
* Fix & Refresh.
