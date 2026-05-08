---
name: /mega-test
description: >
  Execute a specific version of the Mega Stress Test Plan using the browser subagent.
  Runs numbered routines sequentially, documents pass/fail per routine, logs new issues
  to OPEN_ISSUES.md, and produces a structured test report.
  TEST AGENT DOES NOT WRITE CODE. Issues go to OPEN_ISSUES.md for a fixing agent.
---

# /mega-test — Mega Stress Test Execution Protocol

> **Purpose:** Execute numbered routines from a specific Mega Stress Test plan file
> against the live running application using the browser subagent.
> **Mode:** STRICTLY OBSERVATIONAL — no code modifications, no source reading. EVER.
> **Output:** Per-routine pass/fail log + all new issues → `OPEN_ISSUES.md`

---

## 0. PRIME RULES (READ BEFORE ANYTHING ELSE)

You are a **test executor**, not an engineer.

You DO:
- Open the browser subagent and navigate the live app
- Execute each routine's exact steps as written in the plan
- Screenshot every meaningful state, error toast, and failure
- Report PASS, PARTIAL, or FAIL per routine with a 1-line reason
- Append new issues to `OPEN_ISSUES.md` using the standard format

You do NOT:
- Read source code
- Modify any files (except appending to `OPEN_ISSUES.md` and the test report)
- Run terminal commands other than checking the app is running
- Diagnose root causes or suggest code fixes
- Skip routines because they "seem fine" — every routine must execute

---

## 1. INITIALIZATION

### Step 1 — Determine which test plan to run

Read the user's input. It will be one of:

| Input | Behavior |
|-------|---------|
| `/mega-test` (no args) | Run the highest-version plan found in `.agent/test_ledger/` |
| `/mega-test v4` | Run `MEGA_STRESS_TEST_V4_REGRESSION.md` |
| `/mega-test v4 section 3` | Run only Section 3 of V4 |
| `/mega-test v4 101-110` | Run only routines 101–110 of V4 |
| `/mega-test regression` | Run all routines tagged `[REGRESSION]` across all plans |

### Step 2 — Read the target test plan in full

```bash
cat .agent/test_ledger/MEGA_STRESS_TEST_V<N>_*.md
```

Before touching the browser, read every routine in the plan. Build a mental checklist of:
- What modules you will need to navigate to
- What user actions are required (typing, clicking, uploading)
- What the PASS condition is for each routine
- Which routines are tagged `OPEN` (still-open issues — document state, don't skip)

### Step 3 — Read OPEN_ISSUES.md to know the current issue count

```bash
tail -30 .agent/test_ledger/OPEN_ISSUES.md
```

Note the last ISSUE number (e.g., `ISSUE-043`). Any new issues you file start at `ISSUE-044`.

### Step 4 — Confirm the app is running

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4242
```

If the response is not `200`, stop and ask the user to start the dev server:
```bash
npm run dev:web
```
Do not proceed until the app is confirmed running.

### Step 5 — Open the browser subagent

Launch the browser subagent targeting `http://localhost:4242`. Take an initial screenshot
to confirm the app loaded. Note the starting state (which module is active, any toast
messages, loading spinners). This screenshot is your baseline.

---

## 2. EXECUTION PROTOCOL

### 2.1 Routine Execution Loop

For each routine in the test plan:

1. **Read the routine** — understand the full scenario before clicking anything.
2. **Navigate** — get to the correct module using the sidebar.
3. **Execute** — follow the exact steps described in the routine.
4. **Observe** — watch for the specific PASS/FAIL condition stated in the routine.
5. **Screenshot** — take a screenshot of the final state (pass or fail).
6. **Record** — append to your running test report (see Section 4).
7. **Log issues** — if FAIL or PARTIAL, append to `OPEN_ISSUES.md`.

### 2.2 Browser Subagent Usage Rules

When calling `browser_subagent`, always:

- **Provide the full routine text** as task context — do not paraphrase or abbreviate it.
- **Specify the exact PASS condition** so the subagent knows what to verify.
- **Ask for console error reporting** — always request the subagent note any browser console errors.
- **Request a screenshot at the end** — the subagent must capture the final state.
- **Give it enough time** — set generous timeouts for AI generation routines (2+ minutes).

Example browser subagent call structure (do NOT copy verbatim — adapt to each routine):

```
Task: Execute Mega Stress Test Routine <N>: "<Routine Title>"

Context:
- App URL: http://localhost:4242
- Starting module: <module name>
- Current user state: <note any pre-existing data or state>

Steps to execute:
<paste the exact routine steps from the test plan>

PASS condition: <paste the verification criteria from the routine>
FAIL condition: Any deviation from PASS condition, or a browser console error.

Required output:
1. Screenshot of the final state
2. PASS | PARTIAL | FAIL verdict with 1-line explanation
3. Any browser console errors observed
4. Exact time taken for the routine (start to finish)
```

### 2.3 Verdict Definitions

| Verdict | When to Use |
|---------|-------------|
| ✅ PASS | The routine's PASS condition was fully met. No errors, no deviations. |
| ⚠️ PARTIAL | The feature works but with minor degradation (slower than expected, console warning, minor visual glitch). Not a full failure. |
| ❌ FAIL | The PASS condition was NOT met, OR a blocking console error occurred. |
| 🔵 OPEN | Routine was for an already-open issue. Document current state. No verdict required. |

### 2.4 OPEN Routine Handling

Routines labeled `(ISSUE-NNN — OPEN)` test issues that were OPEN at test plan creation time.
For these routines:
- Execute the routine exactly as written
- Do NOT mark PASS or FAIL — mark `🔵 OPEN`
- Record the **current observed behavior** precisely
- If the behavior has improved since the issue was filed, note it
- If unchanged, note it
- If it has gotten worse, mark it `❌ FAIL [REGRESSION]` and file a new issue

### 2.5 Regression Detection Rule

If a routine maps to a previously `✅ FIXED` issue and you observe it failing:

1. Mark the routine `❌ FAIL [REGRESSION]`
2. Immediately file a new issue in `OPEN_ISSUES.md`:
   ```
   ### ISSUE-NNN: [REGRESSION] <Original Issue Title>
   - **Status:** OPEN
   - **Severity:** 🔴 HIGH (regression of previously fixed issue)
   - **Module:** <module>
   - **Found:** <date> by Mega Stress Test V<X> Routine <N>
   - **Summary:** This issue was previously fixed (ISSUE-XXX) but has regressed.
   - **Observed behavior:** <exact description of what happened>
   - **Expected behavior:** <what the fix should have guaranteed>
   ```

---

## 3. MODULE NAVIGATION GUIDE

Use these exact sidebar navigation paths for each module:

| Module | How to Navigate |
|--------|----------------|
| Boardroom | Click "Boardroom HQ" in the left sidebar |
| Creative Director | Click "Creative Director" in the left sidebar |
| Audio Analyzer | Click "Audio Intelligence" or "Audio Analyzer" in the TOOLS section |
| Workflow Builder | Click "Workflow Builder" in the TOOLS section |
| Knowledge Base | Click "Knowledge Base" in the TOOLS section |
| Observability | Click "Observability" or "Observability Matrix" in the TOOLS section |
| Finance | Click "Finance" in the left sidebar |
| Marketing | Click "Marketing" in the left sidebar |
| Distribution | Click "Distribution" in the left sidebar |
| Memory Agent | Click the Memory Agent entry in the TOOLS section |
| Agent Picker | Click the agent avatar/portrait ring or "Change Agent Mode" button |
| Settings | Click the gear icon (⚙️) in the bottom-left or top-right corner |

If a module is not visible in the sidebar, it may be hidden under a "More" or "Tools" expand
button. Always expand the full sidebar before declaring a module missing.

---

## 4. TEST REPORT FORMAT

Maintain a running test report throughout the session. At the end, finalize it as an artifact.

### 4.1 Report Header

```markdown
# Mega Stress Test V<N>.0 Execution Report

**Date:** <ISO date>
**Plan:** MEGA_STRESS_TEST_V<N>_*.md
**Routines Executed:** <X> of <Y> total
**Build:** Dev (localhost:4242) | Production (specify if applicable)
**Executor:** Browser Subagent (Antigravity)

## Summary

| Verdict | Count |
|---------|-------|
| ✅ PASS | X |
| ⚠️ PARTIAL | X |
| ❌ FAIL | X |
| 🔵 OPEN (state documented) | X |
| ❌ FAIL [REGRESSION] | X |

**New issues filed:** ISSUE-NNN through ISSUE-MMM
```

### 4.2 Per-Routine Entry

Append one entry per routine:

```markdown
### Routine <N>: <Title> (<ISSUE-NNN reference if applicable>)
- **Verdict:** ✅ PASS | ⚠️ PARTIAL | ❌ FAIL | 🔵 OPEN
- **Duration:** ~<seconds>s
- **Observed:** <1-3 sentences describing exactly what happened>
- **Console errors:** None | <error text if present>
- **Screenshot:** <description of what is captured>
- **New issue filed:** None | ISSUE-NNN
```

### 4.3 Report Footer

At the end of the session:

```markdown
## Section Summary

| Section | Total | PASS | PARTIAL | FAIL | REGRESSION |
|---------|-------|------|---------|------|------------|
| Section 1: <name> | X | X | X | X | X |
| Section 2: <name> | X | X | X | X | X |
...

## New Issues Filed This Run
- ISSUE-NNN: <title> (<severity>)
- ...

## Regressions Detected
- ISSUE-NNN: [REGRESSION] <title>
- ...

## Deferred / Blocked Routines
- Routine <N>: <reason it could not execute> (e.g., module not accessible, prerequisite missing)

## Recommendations
<1-3 sentences on what the fix agent should prioritize first>
```

---

## 5. ISSUE FILING FORMAT (OPEN_ISSUES.md)

All new issues must follow this exact format. Append to the bottom of `OPEN_ISSUES.md`.
Do not edit existing entries.

```markdown
### ISSUE-<NNN>: <Short descriptive title>
- **Status:** OPEN
- **Severity:** 🔴 HIGH | 🟡 MEDIUM | 🟢 LOW
- **Module:** <module name>
- **Found:** <YYYY-MM-DD> by Mega Stress Test V<N> (Routine <N>)
- **Summary:** <2-3 sentences. What is the issue? What did the user attempt? What actually happened?>
- **Steps to Reproduce:**
  1. Navigate to <module>
  2. <Exact action>
  3. <Observe the failure>
- **Expected:** <What should have happened>
- **UX Impact:** <What can the user NOT do because of this? How severe is the experience break?>
```

Severity guide:
- 🔴 HIGH — Feature is broken, data was lost, or the UI is unusable
- 🟡 MEDIUM — Feature works but with friction, partial failure, or inconsistency
- 🟢 LOW — Polish issue, cosmetic bug, or minor UX improvement

---

## 6. SECTION-LEVEL CHAOS FINALE

Every V4+ test plan ends with a "Chaos Finale" note specifying which routines to combine
simultaneously. To execute this:

1. Open **4 browser tabs** all pointing to `http://localhost:4242` and logged in as the same user.
2. Assign one routine per tab.
3. Start all 4 routines **at the same time** (within a 5-second window).
4. Let them run for at least **5 minutes** without intervening.
5. After 5 minutes, check each tab for:
   - Any crash, blank screen, or infinite spinner
   - Any cross-tab state corruption (e.g., tab 1's agent shows tab 3's data)
   - Memory pressure (browser tab memory usage in Task Manager)
   - Any console errors logged during the concurrent run
6. Record the combined result as **Chaos Finale: ✅ PASS | ❌ FAIL**.

---

## 7. QUICK REFERENCE

```
/mega-test                  → Run highest-version plan, all routines
/mega-test v4               → Run V4 plan, all routines
/mega-test v4 section 3     → Run only V4 Section 3
/mega-test v4 101-115       → Run only routines 101–115
/mega-test regression       → Run only [REGRESSION]-tagged routines

Output files:
  .agent/test_ledger/OPEN_ISSUES.md          ← Append new issues HERE
  artifacts/mega_v<N>_<date>_results.md      ← Session test report
  .agent/test_ledger/REAL_TEST_HISTORY.md    ← Append one-line summary
```

At the end of EVERY run, append one line to `REAL_TEST_HISTORY.md`:
```
## <DATE> — Mega Test V<N> — Routines <X>-<Y>: <PASS_COUNT>✅ <FAIL_COUNT>❌ <NEW_ISSUE_COUNT> new issues
```

---

## 8. ANTI-PATTERNS (DO NOT DO THESE)

| Anti-Pattern | Why It's Wrong |
|-------------|---------------|
| Skipping a routine because it "looks fine" | Every routine must run. The PASS condition is not assumed. |
| Filing vague issues ("Something broke in Creative") | Every issue needs exact steps to reproduce. |
| Marking PARTIAL when it's clearly FAIL | Do not soften failures. The fix agent needs accurate severity. |
| Reading `src/` files to understand why something failed | You are the user. You don't have source access. |
| Running all 35 routines in one giant browser subagent call | Split into sections. Browser subagent has a context limit. Aim for 5–10 routines per call. |
| Declaring FAIL because a feature is slow (> 30s) | Log it as PARTIAL with timing data unless it fully times out. |
| Filing a new issue for something already in OPEN_ISSUES.md | Check the ledger first. Add a comment to the existing issue instead. |
