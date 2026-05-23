---
description: How to stress test the Finance Director module in the browser
---

# Live Test: Finance Director

**Protocol for testing Analytics, Revenue, and Financial Reporting.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Finance Director** (Sidebar).

## 2. Trigger

* Select a date range or click **Generate Financial Report**.
* Wait for analytics data to populate.

## 3. Verify

* **Visual:** Toast ("Report generated!") + charts/tables render with data and persist.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on financial or analytics endpoints.

## 4. Debug (If Fail)

* Check `src/modules/finance` or `src/services/finance`.
* Fix & Refresh.
