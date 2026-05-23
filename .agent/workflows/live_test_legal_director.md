---
description: How to stress test the Legal Director module in the browser
---

# Live Test: Legal Director

**Protocol for testing Contracts, Splits, and Registrations.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Legal Director** (Sidebar).

## 2. Trigger

* Create a new mock split sheet or contract template.
* Click **Save** or **Execute Contract**.

## 3. Verify

* **Visual:** Toast ("Contract executed successfully!") + contract appears in the registry.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on legal or contract endpoints.

## 4. Debug (If Fail)

* Check `src/modules/legal` or `src/services/legal`.
* Fix & Refresh.
