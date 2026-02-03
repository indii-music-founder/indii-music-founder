---
name: Poll Agent Bridge
description: Autonomous monitoring skill. Checks AGENT_BRIDGE.md for build status and auto-triggers QA based on protocol.
---

# 📡 Skill: Poll (@poll)

This skill allows Antigravity to act as an autonomous QA monitor by checking the status of the `AGENT_BRIDGE.md` file.

## ⚡ Usage

User says: "Poll" or "@poll"

## 🧠 Logic

1. **Read Bridge:** View `AGENT_BRIDGE.md`.
2. **Parse Status:** Extract `**STATUS:**` value.
3. **Evaluate:**
    * If `BUILD_COMPLETE`:
        * **Action:** Trigger `auto_qa` workflow (Run Browser Test).
        * **Log:** "Build detected. Launching QA..."
    * If `QA_FAILED`:
        * **Action:** Wait. (OpenClaw is working).
        * **Log:** "Waiting for OpenClaw (Status: QA_FAILED)."
    * If `QA_PASSED`:
        * **Action:** Idle.
        * **Log:** "System Stable. Waiting for new changes."
    * If `QA_IN_PROGRESS`:
        * **Action:** Abort.
        * **Log:** "QA already running."

## 🔧 Workflow Integration

This skill effectively wraps the "decision logic" before the `auto_qa` workflow runs. It is the "Brain" deciding *when* to run the test.
