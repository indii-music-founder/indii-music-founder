---
name: /mega
description: >
  The Master Orchestrator for the Mega Stress Test. Sweeps EVERY left-menu item —
  managers, departments, tools, projects/dashboards — running the full per-item gauntlet
  (`/mega-test <item>`) against each, grouped by sidebar category. Can run autonomously for
  hours, cycling the entire menu on a loop until explicitly stopped.
  The target taxonomy is the live sidebar registry in `.agent/test_ledger/departments_test_config.json`.
  Numbered V1–V12 plans are reusable depth-packs, NOT the unit of work.
  TEST AGENT DOES NOT WRITE CODE. Issues go to .agent/test_ledger/OPEN_ISSUES.md for a fixing agent.
---

> [!IMPORTANT]
> **CRITICAL ISSUE TRACKING RULE:**
> You MUST ONLY log issues in `.agent/test_ledger/OPEN_ISSUES.md`. Do NOT create new or standalone markdown files (like BROWSER_ISSUES.md or issue-specific files) for issues.


# /mega — Master Menu-Sweep Orchestrator

> **Purpose:** Drive `/mega-test` across every item in the live left menu, grouped by category,
> evaluating each across the 12 critical dimensions (including the Asset Generation Gauntlet).
> **The unit of work is a menu item.** `/mega` = "test every menu item." Numbered plans are
> depth-packs you attach to individual items, not the loop axis.
> **Mode:** STRICTLY OBSERVATIONAL — no code modifications. EVER.
> **Duration:** Designed to run for hours. The agent cycles the whole menu on a loop until the user says stop.
> **Output:** Per-item verdicts → `.agent/test_ledger/OPEN_ISSUES.md` + session reports.

---

## 0. THE PRIME RULES

1. **You are a relentless QA machine.** You do not stop until the user tells you to, or until every menu item has a verdict.
2. **You do not write code.** Issues go to `.agent/test_ledger/OPEN_ISSUES.md` for a separate fixing agent.
3. **You do not read source code.** You are a user. You click, type, and observe.
4. **You do not skip menu items.** Every registry item must be tested and receive a verdict.
5. **You delegate per item.** Each item is one `/mega-test <item>` run. Inside an item, batch browser scenarios 5–8 at a time.
6. **You log continuously.** After every item, append results to the running report and update `.agent/test_ledger/OPEN_ISSUES.md` before starting the next item.

---

## 1. THE TARGET REGISTRY (THE MENU)

The canonical list of items to sweep is **`.agent/test_ledger/departments_test_config.json`**, which mirrors the live sidebar in [Sidebar.tsx](packages/renderer/src/core/components/Sidebar.tsx). Build the queue from it at startup — never hardcode the list:

```bash
python3 -c "import json; c=json.load(open('.agent/test_ledger/departments_test_config.json')); [print(v.get('category'),'|',k,'|',v.get('name')) for k,v in c.items()]"
```

Items group into seven categories. Default sweep order:

1. **Manager's Office** (`manager`) — Brand Manager, Road Manager, Campaign Manager, Booking Agent, Publicist, Creative Director
2. **Departments** (`department`) — Marketing, Social Media, Legal, Publishing, Finance, Distribution, Licensing, Art & Merch, Registration Center, Security Agent
3. **Tools** (`tool`) — Workflow Builder, Audio Analyzer, Knowledge Base, Memory Agent, Command Center, Settings, Mobile Remote
4. **Projects & Dashboards** (`project`) — HQ Dashboard, Boardroom HQ, Founders Checkout, Onboarding
5. **Right Bar** (`rightbar`) — Context Controls, Project Assets, Artifacts, Omni Agent
6. **Top Bar** (`topbar`) — Creative Studio Toolbar, Design Toolbar, Agent Toolbar, Marketing Toolbar
7. **Continuity Chains** (`continuity`) — Aesthetic chain, Longitudinal Finance chain, Identity chain — backend cross-pollination of information (run LAST, since they depend on the UI surfaces above being healthy)

> Per-item testing depth, connections, the 12 dimensions, and the continuity-chain discipline all live in `/mega-test`. `/mega` is the sweep driver. The category order is fixed: UI surfaces first (so a broken capture point is caught before the chains that depend on it), continuity chains last.

---

## 2. INVOCATION MODES

### 2.1 Command Syntax

```
/mega                        → Full Sweep: every menu item, grouped by category, in order
/mega managers               → Sweep only the Manager's Office category
/mega departments            → Sweep only the Departments category
/mega tools                  → Sweep only the Tools category
/mega projects               → Sweep only Projects & Dashboards
/mega rightbar               → Sweep only the Right Bar (Omni-Panel tabs)
/mega topbar                 → Sweep only the per-module Top Bar toolbars
/mega continuity             → Sweep only the Continuity Chains (cross-pollination)
/mega road-manager           → Single item (equivalent to /mega-test road-manager)
/mega loop                   → Infinite Loop: cycle the whole menu repeatedly until stopped
/mega loop managers tools    → Selective Loop: cycle only the named categories/items
/mega chaos                  → Chaos Mode: run only each item's most destructive scenarios
/mega coverage               → Coverage Report: don't test — analyze gaps from the registry
/mega + /real                → Hybrid: alternate menu-item gauntlets with freeform /real scenarios
```

### 2.2 Default Behavior (`/mega` with no args)

Sweep the **entire menu** in category order: Managers → Departments → Tools → Projects.
For each item, run the full `/mega-test <item>` gauntlet (scoped runner + 12-dimension browser pass).
Print a progress line after each item and a category summary after each group.

---

## 3. EXECUTION ENGINE

### 3.1 Startup Sequence

```
Step 1 — Build the sweep queue from the registry
```
```bash
python3 -c "import json; c=json.load(open('.agent/test_ledger/departments_test_config.json')); [print(v.get('category'),'|',k) for k,v in c.items()]"
```
Group by category, order Managers → Departments → Tools → Projects. Filter to the requested subset if the invocation named one.

```
Step 2 — Read current issue count
```
```bash
grep -c "^### ISSUE-" .agent/test_ledger/OPEN_ISSUES.md
```
Note the last ISSUE number. All new issues start after that.

```
Step 3 — Read previously fixed issues (regression candidates)
```
```bash
grep "FIXED" .agent/test_ledger/OPEN_ISSUES.md | tail -20
```

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
Create a running report artifact. It grows throughout the session.

### 3.2 The Sweep Loop (Core Engine)

```
┌──────────────────────────────────────────────────┐
│  MEGA MENU-SWEEP LOOP                              │
│                                                    │
│  for each CATEGORY in [Managers, Departments,      │
│       Tools, Projects, RightBar, TopBar,           │
│       Continuity(last)]:                           │
│    for each ITEM in category:                      │
│      1. Run /mega-test <item> (scoped runner +     │
│         12-dimension browser gauntlet)             │
│      2. Collect verdicts + dimensional scores      │
│      3. Append new issues to OPEN_ISSUES.md        │
│      4. Update running report                      │
│      5. Print a progress line for the item         │
│      6. Brief cooldown (5s) for browser stability  │
│    Print category summary                          │
│  end                                               │
│  If /mega loop: re-queue the whole menu            │
└──────────────────────────────────────────────────┘
```

### 3.3 Per-Item Delegation

Each item is executed by following `.agent/workflows/mega-test.md` inline for that target. Do not reinvent the per-item protocol here — `/mega` sequences items; `/mega-test` defines how one item is tested.

### 3.4 Verdict Definitions
| Verdict | When to Use |
|---------|-------------|
| ✅ PASS | The item's scenarios all met their conditions. No errors. |
| ⚠️ PARTIAL | Works but with degradation (slow, console warning, minor visual glitch). |
| ❌ FAIL | A scenario condition was NOT met, OR a blocking error occurred. |
| ❌ FAIL [REGRESSION] | A previously-fixed issue has returned. File immediately. |
| 🔵 OPEN | Item tests a known-open issue. Document current state only. |
| ⏭️ BLOCKED | Cannot execute (prerequisite missing, module inaccessible). Document why. |

### 3.5 Progress Reporting

After each item:
```
✅ Road Manager: 14 scenarios — 12✅ 1⚠️ 1❌ — 1 new issue (ISSUE-051)
```

After each category:
```
━━━ Manager's Office Complete ━━━
  6 items: Brand✅  Road⚠️  Campaign✅  Booking✅  Publicist✅  Creative❌
  New issues filed: ISSUE-051, ISSUE-052
  Moving to Departments...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4. HYBRID MODE (`/mega + /real`)

Alternate structured menu-item gauntlets with freeform real-user scenarios:

```
Round 1: /mega managers          — Structured: every manager
Round 2: /real chaos             — Freeform chaos
Round 3: /mega departments       — Structured: every department
Round 4: /real deep creative     — Deep creative pipeline
Round 5: /mega tools             — Structured: every tool
Round 6: /real distribution      — Freeform distribution
...
```

Structured sweeps catch systematic gaps; freeform catches what real users do unpredictably. Use both.

---

## 5. COVERAGE ANALYSIS (`/mega coverage`)

When invoked with `coverage`, do NOT run tests. Derive a coverage report **from the registry**, not a hand-maintained version grid.

### 5.1 Build the matrix from the registry + ledger
For each registry item, compute coverage points from:
- Scoped test surface present in `departments_test_config.json` (unit / e2e / connections defined?)
- How many times the item appears in `REAL_TEST_HISTORY.md`
- Whether the item has any OPEN issues

```
Category    Item                 Surface  History  OpenIssues  Coverage
─────────── ──────────────────── ───────  ───────  ──────────  ────────
Managers    Road Manager         U E C    3 runs   0           🟢
Departments Security Agent       U . .    0 runs   0           🔴 (untested)
...
```

### 5.2 Identify gaps
1. Items with no scoped surface defined → registry needs `e2eTestPaths`/connections.
2. Items never appearing in `REAL_TEST_HISTORY.md` → never live-tested.
3. Items not covered by any regression depth-pack → add regression scenarios.

### 5.3 Recommendations
```
🔴 CRITICAL GAPS:
  1. [Item X] has no scoped test surface in the registry — add e2e/connection paths
  2. [Item Y] never live-tested — schedule /mega-test Y

🟡 MEDIUM GAPS:
  3. [Item Z] lacks chaos scenarios — extend its depth-pack
```

---

## 6. INFINITE LOOP MODE (`/mega loop`)

For sustained, multi-day testing:

### 6.1 Loop Behavior
```
Cycle 1: Managers → Departments → Tools → Projects
Cycle 2: Managers → Departments → Tools → Projects
Cycle 3: ...
```

### 6.2 Between-Cycle Actions
1. Print the cycle summary with total PASS/FAIL/REGRESSION counts.
2. Note any new issues filed this cycle prominently.
3. Retest any issues marked `FIXED` since the last cycle.
4. 5-minute cooldown — let the browser settle.
5. Start the next cycle.

### 6.3 Smart Termination
- The user says "stop", "done", "that's enough", etc.
- 3 consecutive cycles with zero new findings (stability achieved).
- The browser crashes and cannot be recovered.

### 6.4 Overnight Reliability
- Never leave the browser idle > 60s.
- If a subagent call times out, log `⏭️ BLOCKED` and move to the next item.
- Every 2 hours, take a full-app screenshot as a "proof of life" checkpoint.
- At the start of each cycle, re-verify `localhost:4242` responds.

---

## 7. CHAOS MODE (`/mega chaos`)

For each menu item, run only its most destructive scenarios (rapid input thrashing, oversized files, concurrent triggers, navigation spam during generation), back-to-back across the whole menu. If an item has a `--deep` depth-pack with a Chaos Finale section, pull those routines for that item. This is the "break everything" mode.

---

## 8. REPORTING & ARTIFACTS

### 8.1 Session Report

At the end of every `/mega` run, produce `artifacts/mega_session_<date>.md`:

```markdown
# Mega Orchestrator Session Report

**Date:** <ISO timestamp>
**Duration:** <hours:minutes>
**Scope:** Full menu | <category> | <items>
**Items Tested:** <N> of <total in registry>
**Cycles Completed:** <N> (if loop mode)

## Executive Summary
<2-3 sentences: overall stability, critical findings, regression status>

## Verdict Breakdown (by category)
| Category | Items | ✅ PASS | ⚠️ PARTIAL | ❌ FAIL | 🔵 OPEN | ❌ REGRESSION |
|----------|-------|---------|-----------|--------|---------|--------------|
| Managers | 6 | ... | ... | ... | ... | ... |
| Departments | 10 | ... | ... | ... | ... | ... |
| Tools | 7 | ... | ... | ... | ... | ... |
| Projects | 4 | ... | ... | ... | ... | ... |
| Right Bar | 4 | ... | ... | ... | ... | ... |
| Top Bar | 4 | ... | ... | ... | ... | ... |
| Continuity | 3 | ... | ... | ... | ... | ... |
| **Total** | **38** | ... | ... | ... | ... | ... |

## New Issues Filed
- ISSUE-XXX: <title> (🔴 HIGH)

## Regressions Detected
- ISSUE-ZZZ: [REGRESSION] <title>

## Coverage Delta
- First-time tested items: <list>
- Still untested: <list>

## Stability Verdict
<ONE of: 🟢 PRODUCTION READY | 🟡 NEEDS WORK | 🔴 NOT READY>
```

### 8.2 Ledger Updates

After every `/mega` run, append to `.agent/test_ledger/REAL_TEST_HISTORY.md`:

```markdown
## <DATE> — /mega <scope> — Cycle <N>
- **Items:** <N> menu items across <categories>
- **Results:** <PASS>✅ <PARTIAL>⚠️ <FAIL>❌ <REGRESSION> regressions
- **New Issues:** ISSUE-XXX through ISSUE-YYY
- **Duration:** <hours:minutes>
- **Verdict:** 🟢 PRODUCTION READY | 🟡 NEEDS WORK | 🔴 NOT READY
```

---

## 9. QUICK REFERENCE

```
/mega                        → Full menu sweep, grouped by category
/mega managers               → Sweep one category
/mega road-manager           → Single item (= /mega-test road-manager)
/mega loop                   → Infinite cycle of the whole menu until stopped
/mega loop managers tools    → Selective infinite cycle
/mega chaos                  → Each item's most destructive scenarios, back-to-back
/mega coverage               → Registry-derived coverage gap analysis (no testing)
/mega + /real                → Hybrid: alternate structured & freeform

Source of truth:
  .agent/test_ledger/departments_test_config.json  ← the menu (target registry)

Output files:
  .agent/test_ledger/OPEN_ISSUES.md          ← Append new issues HERE
  .agent/test_ledger/REAL_TEST_HISTORY.md    ← Append session summary
  artifacts/mega_session_<date>.md           ← Full session report
```

---

## 10. ANTI-PATTERNS (DO NOT DO THESE)

| Anti-Pattern | Why It's Wrong |
|-------------|---------------|
| Sweeping by version number (V7→V1→V2) | The unit is a menu item. Sweep the registry, grouped by category. |
| Hardcoding the item list | Build the queue from `departments_test_config.json` every run — the menu changes. |
| Cramming a whole item into one browser call | Inside an item, batch scenarios 5–8 at a time. |
| Skipping an item because it passed last cycle | Regressions happen. Every item runs every cycle. |
| Filing vague issues ("Something broke") | Every issue needs exact reproduction steps + Target tag. |
| Reading source code to diagnose failures | You are the user. Observe and report. |
| Stopping after one cycle in loop mode | The whole point is sustained testing. Keep going. |
| Not retesting FIXED issues between cycles | The fix agent may have resolved issues. Retest them. |

---

## 11. CLOSING FOLLOW-OUT: `/go`

After every `/mega` session completes (all items swept, report produced, issues filed),
**invoke the `/go` workflow** to perform a recursive progress review: confirm all prompts addressed,
`OPEN_ISSUES.md` consistent, `REAL_TEST_HISTORY.md` appended, artifacts updated, Error Ledger
cross-referenced, and a clean State Snapshot produced. Read and follow `.agent/workflows/go.md` inline.
If `/go` finds blocked items, note them for the next `/mega` invocation.

---

## 12. CLOSING GATE: `/ci-validate`

After `/go` confirms all work is complete, **invoke the `/ci-validate` workflow** as the final gate
before pushing any changes. It ensures any session edits pass typecheck, ESLint, and the full test
suite, with Error Ledger cross-referencing. Read and follow `.agent/workflows/ci-validate.md` inline.
Only after `/ci-validate` passes all green do you proceed to push.

---

## 13. PUSH TO BRANCH

After both `/go` and `/ci-validate` pass:

```bash
git checkout -b mega/session-<YYYY-MM-DD>
git add -A
git commit -m "chore: mega menu sweep <DATE> — <PASS>✅ <FAIL>❌ <NEW_ISSUE_COUNT> issues"
git push origin mega/session-<YYYY-MM-DD>
```
