---
name: /mega
description: >
  The Master Orchestrator for all Mega Stress Tests (V1–V7+).
  Chains every test plan into a continuous, multi-hour gauntlet that simulates
  sustained real-user abuse. Pairs with /real for realistic scenario testing.
  Can run autonomously for hours or even days, cycling through every plan
  on a loop until explicitly stopped by the user.
  TEST AGENT DOES NOT WRITE CODE. Issues go to OPEN_ISSUES.md for a fixing agent.
---

# /mega — Master Mega Stress Test Orchestrator

> **Purpose:** Unify all Mega Stress Test plans (V1–V7+) into a single, continuous,
> long-running test system that simulates sustained real-user abuse across the
> entire indii platform.
> **Mode:** STRICTLY OBSERVATIONAL — no code modifications. EVER.
> **Duration:** Designed to run for hours or days. The agent cycles through every
> plan on a loop until the user says stop.
> **Output:** Per-routine verdicts → `OPEN_ISSUES.md` + session reports.

---

## 0. THE PRIME RULES

1. **You are a relentless QA machine.** You do not stop until the user tells you to,
   or until you have cycled through every plan and every routine has a verdict.
2. **You do not write code.** Issues go to `OPEN_ISSUES.md` for a separate fixing agent.
3. **You do not read source code.** You are a user. You click, type, and observe.
4. **You do not skip routines.** Every routine must execute and receive a verdict.
5. **You batch intelligently.** Send 5–8 routines per browser subagent call to stay
   within context limits. Never try to run all 50 in a single call.
6. **You log continuously.** After every batch, append results to the running report
   and update `OPEN_ISSUES.md` before starting the next batch.

---

## 1. THE MEGA TEST REGISTRY

These are the canonical test plans. The agent must know the full registry.

| Version | File | Focus Area | Routines |
|---------|------|-----------|----------|
| V1 | `MEGA_STRESS_TEST_V1_CORE.md` | Core Architecture, UI Overlaps, z-index, Model Armor | 25 |
| V2 | `MEGA_STRESS_TEST_V2_PLAN.md` | E2E Master Execution, Cross-Module Flows | 50 |
| V3 | `MEGA_STRESS_TEST_V3_TOOLS.md` | Agent Tool Execution Layer, Schema Thrashing | 25 |
| V3.5 | `MEGA_STRESS_TEST_V3_B_TOOLS_MENU.md` | Tools Sidebar Navigation & Module UI | 50 |
| V4 | `MEGA_STRESS_TEST_V4_DEPARTMENTS.md` | Departments Menu & All Department Modules | 50 |
| V5 | `MEGA_STRESS_TEST_V5_MANAGERS.md` | Manager's Office & All Manager Modules | 50 |
| V6 | `MEGA_STRESS_TEST_V6_PROJECTS.md` | Projects & Inbox File Ingestion System | 50 |
| V7 | `MEGA_STRESS_TEST_V7_REGRESSION.md` | Targeted Regression Against All Fixed Issues | 35 |

**Total Routines Across All Plans: ~335**

When new plans are added (V8, V9, etc.), they are automatically picked up
because the agent scans `.agent/test_ledger/MEGA_STRESS_TEST_V*.md` at startup.

---

## 2. INVOCATION MODES

### 2.1 Command Syntax

```
/mega                        → Full Gauntlet: Run ALL plans V1–V7+ sequentially
/mega v5                     → Single Plan: Run only V5 (Manager's Office)
/mega v4 section 3           → Single Section: Run only V4 Section 3
/mega v3 76-85               → Range: Run only routines 76–85 from V3
/mega regression             → Regression Only: Run V7 regression plan
/mega loop                   → Infinite Loop: Cycle V1→V7 repeatedly until stopped
/mega loop v4 v5 v6          → Selective Loop: Cycle only V4, V5, V6 repeatedly
/mega chaos                  → Chaos Mode: Run only the Chaos Finale sections from every plan
/mega coverage               → Coverage Report: Don't test — just analyze coverage gaps
/mega + /real                → Hybrid: Alternate between /mega routines and /real scenarios
```

### 2.2 Default Behavior (`/mega` with no args)

Run the **Full Gauntlet** in this exact order:

1. **V7 (Regression)** — Always first. Verify previously-fixed bugs still hold.
2. **V1 (Core)** — Baseline architecture stability.
3. **V2 (E2E)** — Cross-module flow integrity.
4. **V3 (Tools)** — Agent execution layer.
5. **V3.5 (Tools Menu)** — Tools sidebar UI.
6. **V4 (Departments)** — Department modules.
7. **V5 (Managers)** — Manager's Office modules.
8. **V6 (Projects)** — Inbox and file management.

Regression first ensures no prior fixes have broken before we stress-test new areas.

---

## 3. EXECUTION ENGINE

### 3.1 Startup Sequence

```
Step 1 — Scan the test plan registry
```
```bash
ls -1 .agent/test_ledger/MEGA_STRESS_TEST_V*.md
```
Build the plan queue based on the invocation mode.

```
Step 2 — Read current issue count
```
```bash
grep -c "^### ISSUE-" .agent/test_ledger/OPEN_ISSUES.md
```
Note the last ISSUE number. All new issues start after that.

```
Step 3 — Read previously fixed issues
```
```bash
grep "FIXED" .agent/test_ledger/OPEN_ISSUES.md | tail -20
```
These are candidates for regression testing.

```
Step 4 — Confirm the app is running
```
// turbo
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4242
```
If not `200`, inform the user and wait.

```
Step 5 — Initialize the session report
```
Create a running report artifact. This grows throughout the session.

### 3.2 The Batch Loop (Core Engine)

This is the heart of `/mega`. It runs continuously until the queue is empty or the user stops it.

```
┌──────────────────────────────────────────────────┐
│  MEGA BATCH LOOP                                  │
│                                                    │
│  for each PLAN in queue:                           │
│    1. Read the plan file                           │
│    2. Split into sections                          │
│    3. for each SECTION in plan:                    │
│       a. Build a batch of 5–8 routines             │
│       b. Launch browser_subagent with the batch    │
│       c. Collect results (PASS/PARTIAL/FAIL)       │
│       d. Append new issues to OPEN_ISSUES.md       │
│       e. Update running report                     │
│       f. Print a progress line to the user          │
│       g. Brief cooldown (5s) for browser stability │
│    4. Print plan-level summary                     │
│    5. If /mega loop: re-queue this plan            │
│  end loop                                          │
└──────────────────────────────────────────────────┘
```

### 3.3 Browser Subagent Batch Template

When calling `browser_subagent` for a batch of routines, use this structure:

```
TaskName: "Mega V<N> Section <S> (Routines <X>-<Y>)"
TaskSummary: "Executing routines <X> through <Y> of Mega Stress Test V<N>."
RecordingName: "mega_v<n>_sec<s>_r<x>_r<y>"

Task:
  Execute the following Mega Stress Test routines on http://localhost:4242.
  For each routine, report PASS, PARTIAL, or FAIL with a 1-line explanation.

  <paste the exact routine text for routines X through Y>

  After ALL routines are complete, provide a structured summary:
  - Routine <X>: PASS/PARTIAL/FAIL — <1-line reason>
  - Routine <X+1>: PASS/PARTIAL/FAIL — <1-line reason>
  - ...
  - Any new bugs discovered (with reproduction steps)
  - Any browser console errors observed
```

### 3.4 Verdict Definitions

| Verdict | When to Use |
|---------|-------------|
| ✅ PASS | The routine's condition was fully met. No errors. |
| ⚠️ PARTIAL | Feature works but with degradation (slow, console warning, minor visual glitch). |
| ❌ FAIL | The condition was NOT met, OR a blocking error occurred. |
| ❌ FAIL [REGRESSION] | A previously-fixed issue has returned. File immediately. |
| 🔵 OPEN | Routine tests a known-open issue. Document current state only. |
| ⏭️ BLOCKED | Cannot execute (prerequisite missing, module inaccessible). Document why. |

### 3.5 Progress Reporting

After every batch, print a concise progress line to the user:

```
✅ Mega V5 Section 2 (Routines 9-15): 6 PASS, 1 PARTIAL — 0 new issues
```

After every plan completes, print a plan summary:

```
━━━ Mega V5 (Manager's Office) Complete ━━━
  50 routines: 42 ✅  5 ⚠️  2 ❌  1 🔵
  New issues filed: ISSUE-047, ISSUE-048
  Moving to V6 (Projects)...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4. THE HYBRID MODE (`/mega + /real`)

When invoked with both systems, alternate between structured mega routines and
freeform real-user scenarios:

```
Round 1: /mega v7 (regression)     — Verify fixes hold
Round 2: /real chaos               — Freeform chaos testing
Round 3: /mega v1 (core)           — Structured architecture test
Round 4: /real deep creative       — Deep creative pipeline
Round 5: /mega v4 (departments)    — Structured department test
Round 6: /real distribution        — Freeform distribution pipeline
... (continues alternating)
```

This hybrid approach catches bugs that purely structured tests miss (because
real users do unpredictable things) AND bugs that freeform testing misses
(because real users don't systematically test edge cases).

---

## 5. COVERAGE ANALYSIS (`/mega coverage`)

When invoked with `coverage`, do NOT run tests. Instead, analyze the test ledger
and produce a coverage gap report:

### 5.1 Module Coverage Matrix

```
Module                  V1  V2  V3  V3.5 V4  V5  V6  V7  Total
─────────────────────── ──  ──  ──  ──── ──  ──  ──  ──  ─────
Boardroom/Dashboard     ██  ██  ░░  ░░   ░░  ░░  ░░  ██   12
Creative Director       ██  ██  ██  ░░   ░░  ██  ░░  ██   20
Video Producer          ░░  ██  ░░  ░░   ░░  ██  ░░  ██    9
Audio Analyzer          ░░  ██  ██  ██   ░░  ░░  ░░  ██   12
Workflow Builder        ░░  ░░  ██  ██   ░░  ░░  ░░  ██    9
Knowledge Base          ░░  ░░  ░░  ██   ░░  ░░  ░░  ██    6
Memory Agent            ░░  ░░  ░░  ██   ░░  ░░  ░░  ██    6
Observability           ░░  ░░  ░░  ██   ░░  ░░  ░░  ██    6
Marketing Dept          ░░  ░░  ░░  ░░   ██  ░░  ░░  ░░    3
Finance Dept            ░░  ██  ░░  ░░   ██  ░░  ░░  ░░    6
Distribution Dept       ░░  ██  ░░  ░░   ██  ░░  ░░  ░░    6
Legal Dept              ░░  ░░  ░░  ░░   ██  ░░  ░░  ░░    3
Publishing Dept         ░░  ░░  ░░  ░░   ██  ░░  ░░  ░░    3
Licensing Dept          ░░  ░░  ░░  ░░   ██  ░░  ░░  ░░    3
Art & Merch Dept        ░░  ░░  ░░  ░░   ██  ░░  ░░  ░░    3
Registration Center     ░░  ░░  ░░  ░░   ██  ░░  ░░  ░░    3
Brand Manager           ░░  ░░  ░░  ░░   ░░  ██  ░░  ░░    3
Road Manager            ░░  ░░  ░░  ░░   ░░  ██  ░░  ░░    3
Campaign Manager        ░░  ░░  ░░  ░░   ░░  ██  ░░  ░░    3
Booking Agent           ░░  ░░  ░░  ░░   ░░  ██  ░░  ░░    3
Publicist               ░░  ░░  ░░  ░░   ░░  ██  ░░  ░░    3
Maestro                 ░░  ░░  ░░  ░░   ░░  ██  ░░  ░░    3
Projects/Inbox          ░░  ░░  ░░  ░░   ░░  ░░  ██  ░░    3
Settings                ░░  ░░  ░░  ██   ░░  ░░  ░░  ░░    3
```

### 5.2 Identifying Gaps

After generating the matrix, identify:
1. **Modules with < 6 total coverage points** → Need a new dedicated test plan
2. **Modules only covered by 1 plan** → Need cross-plan coverage
3. **Modules not covered by V7 regression** → Add regression routines

### 5.3 Recommendations

Output a prioritized list:
```
🔴 CRITICAL GAPS:
  1. [Module X] has zero test coverage — create V8 plan
  2. [Module Y] only tested in V2 — add routines to V7 regression

🟡 MEDIUM GAPS:
  3. [Module Z] lacks chaos/edge-case testing — add to V3

🟢 MINOR GAPS:
  4. [Module W] could use more cross-module flow testing
```

---

## 6. INFINITE LOOP MODE (`/mega loop`)

For sustained, multi-day testing:

### 6.1 Loop Behavior

```
Cycle 1: V7 → V1 → V2 → V3 → V3.5 → V4 → V5 → V6
Cycle 2: V7 → V1 → V2 → V3 → V3.5 → V4 → V5 → V6  (regression first again)
Cycle 3: ...
```

### 6.2 Between-Cycle Actions

After completing a full cycle:
1. **Print the cycle summary** with total PASS/FAIL/REGRESSION counts
2. **Check if any new issues were filed** — if yes, note them prominently
3. **Check if any FIXED issues have been updated** since the last cycle — retest them
4. **5-minute cooldown** — let the browser settle, clear caches
5. **Start the next cycle**

### 6.3 Smart Termination

The loop terminates when:
- The user says "stop", "done", "that's enough", etc.
- The agent detects 3 consecutive cycles with zero new findings (stability achieved)
- The browser crashes and cannot be recovered

### 6.4 Overnight Reliability

For overnight runs:
- The agent must **never** leave the browser idle for more than 60 seconds
- If a subagent call times out, log it as `⏭️ BLOCKED` and move to the next batch
- Every 2 hours, take a full-app screenshot as a "proof of life" checkpoint
- At the start of each new cycle, re-verify `localhost:4242` is still responding

---

## 7. CHAOS MODE (`/mega chaos`)

Extract ONLY the Chaos Finale / Section 7 routines from every plan and run them
back-to-back in one concentrated session:

```
V1 Chaos Routines (if any)
V2 Chaos Routines (if any)
V3 Chaos Routines (if any)
V3.5 Section 7: Routines 45-50
V4 Section 7: Routines 45-50
V5 Section 7: Routines 45-50
V6 Section 7: Routines 44-50
V7 Security Chaos (if any)
```

This is the "break everything" mode. It runs approximately 35–50 of the most
destructive routines in sequence.

---

## 8. REPORTING & ARTIFACTS

### 8.1 Session Report

At the end of every `/mega` run, produce a comprehensive artifact:

```markdown
# Mega Orchestrator Session Report

**Date:** <ISO timestamp>
**Duration:** <hours:minutes>
**Plans Executed:** V1, V2, V3, V3.5, V4, V5, V6, V7
**Total Routines:** 335
**Cycles Completed:** <N> (if loop mode)

## Executive Summary
<2-3 sentences: overall stability verdict, critical findings, regression status>

## Verdict Breakdown

| Plan | Routines | ✅ PASS | ⚠️ PARTIAL | ❌ FAIL | 🔵 OPEN | ❌ REGRESSION |
|------|----------|---------|-----------|--------|---------|--------------|
| V1   | 25       | ...     | ...       | ...    | ...     | ...          |
| V2   | 50       | ...     | ...       | ...    | ...     | ...          |
| ...  | ...      | ...     | ...       | ...    | ...     | ...          |
| **Total** | **335** | ... | ... | ... | ... | ... |

## New Issues Filed
- ISSUE-XXX: <title> (🔴 HIGH)
- ISSUE-YYY: <title> (🟡 MEDIUM)

## Regressions Detected
- ISSUE-ZZZ: [REGRESSION] <title>

## Coverage Delta
- First-time tested: <modules>
- Increased coverage: <modules>
- Still untested: <modules>

## Stability Verdict
<ONE of: 🟢 PRODUCTION READY | 🟡 NEEDS WORK | 🔴 NOT READY>
```

### 8.2 Ledger Updates

After every `/mega` run, append to `.agent/test_ledger/REAL_TEST_HISTORY.md`:

```markdown
## <DATE> — /mega <mode> — Cycle <N>
- **Plans:** V1–V7
- **Routines:** 335 executed
- **Results:** <PASS_COUNT>✅ <PARTIAL_COUNT>⚠️ <FAIL_COUNT>❌ <REGRESSION_COUNT> regressions
- **New Issues:** ISSUE-XXX through ISSUE-YYY
- **Duration:** <hours:minutes>
- **Verdict:** 🟢 PRODUCTION READY | 🟡 NEEDS WORK | 🔴 NOT READY
```

---

## 9. QUICK REFERENCE

```
/mega                        → Full Gauntlet: V7→V1→V2→V3→V3.5→V4→V5→V6
/mega v5                     → Single Plan: V5 only
/mega v4 section 3           → Single Section: V4 Section 3 only
/mega v3 76-85               → Range: V3 Routines 76–85 only
/mega regression             → V7 Regression plan only
/mega loop                   → Infinite cycle until stopped
/mega loop v4 v5 v6          → Selective infinite cycle
/mega chaos                  → All Chaos Finale sections, back-to-back
/mega coverage               → Coverage gap analysis (no testing)
/mega + /real                → Hybrid: alternate structured & freeform

Output files:
  .agent/test_ledger/OPEN_ISSUES.md          ← Append new issues HERE
  .agent/test_ledger/REAL_TEST_HISTORY.md    ← Append session summary
  artifacts/mega_session_<date>.md            ← Full session report
```

---

## 10. ANTI-PATTERNS (DO NOT DO THESE)

| Anti-Pattern | Why It's Wrong |
|-------------|---------------|
| Running all 335 routines in one browser subagent call | Context overflow. Batch in groups of 5–8. |
| Skipping a routine because it passed last time | Regressions happen. Every routine must run. |
| Filing vague issues ("Something broke") | Every issue needs exact reproduction steps. |
| Reading source code to diagnose failures | You are the user. You observe and report. |
| Stopping after one cycle when in loop mode | The whole point is sustained testing. Keep going. |
| Not checking for new FIXED issues between cycles | The fix agent may have resolved issues. Retest them. |
| Running /mega without /real at least once per week | Structured tests miss what freeform catches. Use both. |

---

## 11. CLOSING FOLLOW-OUT: `/go`

After every `/mega` session completes (all plans executed, report produced, issues filed),
**invoke the `/go` workflow** to perform a recursive progress review.

This ensures:
1. All user prompts from the session have been acknowledged and addressed
2. The `OPEN_ISSUES.md` ledger is consistent and up-to-date
3. The `REAL_TEST_HISTORY.md` coverage ledger has been appended
4. Any task artifacts or implementation plans are updated
5. The Error Ledger is checked for patterns matching newly discovered issues
6. A clean State Snapshot is produced before handing off

**Execution:**
Read and follow `.agent/workflows/go.md` inline. Complete all steps of the
`/go` protocol including the State Snapshot output and re-evaluation logic.
If `/go` identifies unfinished work (e.g., routines that were blocked and
need re-running), note them for the next `/mega` invocation.

---

## 12. CLOSING GATE: `/ci-validate`

After `/go` confirms all work is complete, **invoke the `/ci-validate` workflow**
as the final quality gate before pushing any changes to a branch.

This ensures:
1. All code changes made during the session (issue fixes, test plan updates) pass typecheck
2. ESLint finds no new violations
3. The full test suite passes across all shards
4. No duplicate identifiers or missing mocks were introduced
5. The Error Ledger patterns are cross-referenced against any failures

**Execution:**
Read and follow `.agent/workflows/ci-validate.md` inline. The `// turbo-all`
annotation means all commands auto-run. If `npm run ci` fails, the agent MUST
fix the code before proceeding to the branch push.

**Only after `/ci-validate` passes with all green do you proceed to push.**

---

## 13. PUSH TO BRANCH

After both `/go` and `/ci-validate` pass, push all changes to a new branch:

```bash
git checkout -b mega/session-<YYYY-MM-DD>
git add -A
git commit -m "chore: mega stress test session <DATE> — <PASS_COUNT>✅ <FAIL_COUNT>❌ <NEW_ISSUE_COUNT> issues"
git push origin mega/session-<YYYY-MM-DD>
```

The branch naming convention `mega/session-<date>` makes it easy to track
which test sessions produced which issue discoveries and code changes.
