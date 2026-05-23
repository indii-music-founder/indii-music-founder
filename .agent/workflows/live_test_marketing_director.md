---
description: How to stress test the Marketing Director module in the browser
---

# Live Test: Marketing Director

**Protocol for testing Marketing Campaigns and Brand Asset generation.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Marketing Director** (Sidebar).

## 2. Trigger

* Input a campaign goal or select "Generate Social Assets".
* Click **Generate** or **Create Campaign**.

## 3. Verify

* **Visual:** Toast ("Campaign created successfully!") + campaign assets or plan appears.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on campaign generation endpoints.

## 4. Debug (If Fail)

* Check `src/modules/marketing` or `src/services/marketing`.
* Fix & Refresh.
