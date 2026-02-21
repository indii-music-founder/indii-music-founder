---
name: auto_qa
description: Autonomous Visual QA for indiiOS. Uses the browser subagent to visually inspect the live app at localhost:4242, capture screenshots, and report results back via AGENT_BRIDGE.md for OpenClaw to read. Triggered when a build completes or when OpenClaw signals BUILD_COMPLETE.
---

# @auto_qa — Autonomous Visual QA

## Purpose

Perform eyes-on validation of the running application without human intervention. The browser subagent navigates the UI, checks for visual regressions, console errors, and broken states, then writes a structured report to `AGENT_BRIDGE.md` for OpenClaw to consume.

## When to Invoke

- OpenClaw signals `STATUS: BUILD_COMPLETE` in `AGENT_BRIDGE.md`
- After a major feature deployment
- As part of CI validation before pushing to `main`
- When `/go` Gauntlet is not sufficient (UI-only bugs)

---

## Step 1 — Bridge Status Check

```bash
cat AGENT_BRIDGE.md | grep STATUS
```

| Bridge Status | Action |
|--------------|--------|
| `QA_IN_PROGRESS` | **Abort** — don't duplicate a running QA session |
| `QA_PASSED` | **Abort** — already validated |
| `BUILD_COMPLETE` | **Proceed** |
| `PROTOCOL_INIT` | **Proceed** |

---

## Step 2 — Set Bridge to In-Progress

Update `AGENT_BRIDGE.md`:

```
STATUS: QA_IN_PROGRESS
QA_STARTED: [timestamp]
```

---

## Step 3 — Launch Visual Tests

Use `browser_subagent` to navigate and inspect:

### Core Modules to Test

```
1. Dashboard    → http://localhost:4242/
2. Creative     → http://localhost:4242/creative
3. Video        → http://localhost:4242/video
4. Social       → http://localhost:4242/social
5. Distribution → http://localhost:4242/distribution
6. Finance      → http://localhost:4242/finance
7. Workflow     → http://localhost:4242/workflow
8. Agent        → http://localhost:4242/agent
```

### What to Check on Each Page

- [ ] No "undefined" or "[object Object]" in rendered text
- [ ] No red error banners or broken states
- [ ] Console: no 403/401/404/500 errors
- [ ] Console: no `Cannot read properties of undefined` crashes
- [ ] Loading spinners resolve (not stuck indefinitely)
- [ ] Primary CTA buttons are visible and not disabled unexpectedly

### Screenshot Protocol

Capture one screenshot per module. Name format: `qa_[module]_[pass|fail]_[timestamp].png`

---

## Step 4 — Analyze & Write Report

Based on findings, write to `AGENT_BRIDGE.md`:

**If PASS:**

```markdown
STATUS: QA_PASSED
QA_COMPLETED: [timestamp]
MODULES_TESTED: Dashboard, Creative, Video, Social, Distribution, Finance, Workflow, Agent
ISSUES_FOUND: None
```

**If FAIL:**

```markdown
STATUS: QA_FAILED
QA_COMPLETED: [timestamp]
ISSUES_FOUND:
- [Module] - [Description of issue] - [Screenshot path]
- [Module] - [Console error text]
NEEDS:
- [Fix description]
```

---

## Step 5 — Signal Handoff

Add to `AGENT_BRIDGE.md`:

```
LOG: QA Cycle complete @ [timestamp]. Waiting for OpenClaw directive.
```

If failures found → immediately begin fixing. If clean → wait.

---

## Key Config

```
Dev Server URL:  http://localhost:4242
Bridge File:     AGENT_BRIDGE.md (project root)
Screenshot Dir:  .agent/artifacts/qa_screenshots/
```
