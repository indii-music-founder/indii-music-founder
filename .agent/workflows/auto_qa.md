---
description: Autonomous Visual QA Workflow for Antigravity
---

# Auto QA Workflow

This workflow allows Antigravity to autonomously test the application and report back to OpenClaw via `AGENT_BRIDGE.md`.

## Steps

1. **Check Bridge Status**
    Read `AGENT_BRIDGE.md`.
    - If Status is `QA_IN_PROGRESS` or `QA_PASSED`, abort (don't duplicate work).
    - If Status is `BUILD_COMPLETE` or `PROTOCOL_INIT`, proceed.

2. **Update Bridge Limit**
    Write to `AGENT_BRIDGE.md`:
    - Set `STATUS: QA_IN_PROGRESS`.

3. **Launch Visual Test**
    // turbo
    Use `browser_subagent` to:
    - Open `http://localhost:4242`.
    - Navigate to `/workflow`.
    - Check for "undefined" text or red warning icons.
    - Check browser console for errors.
    - Screenshot the result.

4. **Analyze & Report**
    Based on the browser findings:
    - If errors found -> Write `STATUS: QA_FAILED` and populate `[NEEDS]` section.
    - If clean -> Write `STATUS: QA_PASSED`.

5. **Signal Handoff**
    Add a log entry: "QA Cycle Complete. Waiting for OpenClaw."

## Usage

Run directly when OpenClaw signals a build is ready, or use via trigger.
