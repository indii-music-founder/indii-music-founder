---
description: How to stress test the Workflow Conductor in the browser
---

# Live Test: Workflow Conductor

**Protocol for testing Agent Orchestration and Workflow automation.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Workflow** or **Conductor** (Sidebar).

## 2. Trigger

* Create a multi-step workflow involving at least two agents.
* Click **Execute Workflow** or **Run**.

## 3. Verify

* **Visual:** Toast ("Workflow initiated!") + workflow graph shows active execution state.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on agent orchestration endpoints.

## 4. Debug (If Fail)

* Check `src/modules/workflow` or `src/services/agent`.
* Fix & Refresh.
