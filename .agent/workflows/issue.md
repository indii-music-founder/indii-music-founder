---
name: /issue
description: >
  The Fix Agent. Scans OPEN_ISSUES.md for unresolved issues, triages by severity,
  diagnoses root causes in source code, applies surgical fixes, verifies them,
  and marks issues as FIXED. This is the counterpart to /mega and /real which
  only find issues — /issue is the one that resolves them.
  THE FIX AGENT DOES NOT RUN TESTS. It reads issues, patches code, and verifies.
---

# /issue — Automated Issue Resolution Agent

> **Purpose:** Read `OPEN_ISSUES.md`, pick up unresolved issues, and fix them.
> **Mode:** ENGINEERING — full source code access, full terminal access.
> **Counterpart:** `/mega` and `/real` find issues. `/issue` fixes them.
> **Output:** Code patches + updated issue statuses in `OPEN_ISSUES.md`.

---

## 0. THE PRIME RULES

1. **You are the fix agent.** You read bug reports written by the test agent
   and apply targeted, surgical code fixes.
2. **You do NOT run the full test suite to find NEW bugs.** That's `/mega`'s job.
   You only verify YOUR fixes work.
3. **You prioritize by severity.** 🔴 HIGH first, then 🟡 MEDIUM, then 🟢 LOW.
4. **You follow the Two-Strike Rule.** If a fix fails verification twice,
   STOP and re-diagnose from scratch (see Section 4.3).
5. **You update OPEN_ISSUES.md** after every fix with status, commit hash, and
   a 1-line description of what you changed.
6. **You do NOT delete or rewrite issues.** You only update the `Status` field
   and append fix notes.

---

## 1. INVOCATION MODES

```
/issue                       → Fix all OPEN issues, highest severity first
/issue 45                    → Fix only ISSUE-045
/issue 45 46 47              → Fix specific issues in order
/issue high                  → Fix only 🔴 HIGH severity issues
/issue medium                → Fix only 🟡 MEDIUM severity issues
/issue low                   → Fix only 🟢 LOW severity issues
/issue triage                → Don't fix — just read and prioritize the backlog
/issue count                 → Quick count of OPEN issues by severity
```

---

## 2. INITIALIZATION

### Step 1 — Read the full OPEN_ISSUES.md

```bash
cat .agent/test_ledger/OPEN_ISSUES.md
```

Parse every issue. Build a work queue sorted by:
1. 🔴 HIGH severity (fix first — these block releases)
2. 🟡 MEDIUM severity (fix second — these cause user friction)
3. 🟢 LOW severity (fix last — these are polish)

Within the same severity, sort by issue number (oldest first).

### Step 2 — Filter by invocation mode

- If `/issue` (no args): queue = all OPEN issues
- If `/issue 45`: queue = [ISSUE-045] only
- If `/issue high`: queue = all OPEN 🔴 HIGH issues
- If `/issue triage`: skip to Section 5 (Triage Mode)

### Step 3 — Check the Error Ledger

Before touching any code:
```bash
cat .agent/skills/error_memory/ERROR_LEDGER.md
```
Cross-reference the issue descriptions against known error patterns.
If a match exists, apply the documented fix verbatim.

### Step 4 — Print the work queue

Show the user exactly what will be fixed and in what order:

```
━━━ /issue Work Queue ━━━
  1. ISSUE-045: Omni Agent Message Dispatch Failure (🔴 HIGH)
  2. ISSUE-046: Department Module CSS/Typography Scaling (🟡 MEDIUM)
  3. ISSUE-043: Sidebar Routing History Inconsistency (🟢 LOW)
━━━ 3 issues queued ━━━
```

---

## 3. THE FIX LOOP

For each issue in the queue, execute these steps in order:

### 3.1 Understand the Issue

Read the issue entry carefully. Extract:
- **What broke:** The user-facing symptom
- **Steps to reproduce:** The exact click path
- **Module:** Which part of the codebase to investigate
- **UX Impact:** How severe the user experience break is

### 3.2 Locate the Root Cause

Use the reproduction steps and module information to find the relevant source files.

```
Search strategy:
1. grep for the module name in src/modules/
2. grep for error messages mentioned in the issue
3. grep for component names visible in the UI
4. Check recent git log for the module (recent changes = likely culprits)
```

```bash
# Example investigation commands
grep -r "ModuleName" packages/renderer/src/modules/ --include="*.tsx" -l
git log --oneline -10 -- packages/renderer/src/modules/<module>/
```

### 3.3 Apply the Fix

Rules for fixing:
- **Surgical precision.** Change the minimum number of lines needed.
- **No collateral damage.** Do not refactor adjacent code unless it's directly related.
- **Preserve existing comments and docstrings.** Do not delete documentation.
- **Follow existing patterns.** Match the code style of the file you're editing.
- **Boy Scout Rule.** Fix obvious lint errors or unused imports in the immediate
  vicinity of your changes. Delete zombie (commented-out) code blocks.

### 3.4 Verify the Fix

After applying the fix:

1. **Type-check:** Run `npm run typecheck` to ensure no TypeScript errors
2. **Lint:** Run `npm run lint` to ensure no ESLint violations
3. **Unit tests:** Run `npm test -- --run` to ensure no test regressions
4. **Browser verify (if applicable):** Use `browser_subagent` to reproduce
   the original steps and confirm the issue is resolved

### 3.5 Update OPEN_ISSUES.md

After a successful fix, update the issue entry:

```markdown
### ISSUE-045: Omni Agent Message Dispatch Failure
- **Status:** ✅ FIXED (<commit_hash>)
- **Severity:** 🔴 HIGH
- ... (keep all original fields)
- **Fix:** <1-2 sentences describing the code change>
- **Files:** `<file1.ts>`, `<file2.tsx>`
- **UX Impact:** <updated to reflect the fixed state>
```

**Rules:**
- Change `Status` from `OPEN` to `✅ FIXED (<commit_hash>)`
- Add a `Fix:` field with a concise description
- Add a `Files:` field listing every file modified
- Update `UX Impact:` to reflect the resolved state
- Do NOT delete any original fields (Steps to Reproduce, Summary, etc.)

### 3.6 Print Progress

After each issue is fixed:

```
✅ ISSUE-045: Omni Agent Message Dispatch Failure — FIXED
   Changed: OmniAgentPanel.tsx (added event handler binding to send button)
   Verified: typecheck ✅ lint ✅ tests ✅ browser ✅
```

---

## 4. SPECIAL PROTOCOLS

### 4.1 The Two-Strike Pivot Rule

If a fix fails verification **twice**:

1. **STOP** the current approach immediately
2. **Re-diagnose:** Add extensive logging to prove the root cause
3. **Alternative:** Propose a fundamentally different solution
4. **Never pivot to the "easy way out"** (e.g., hiding the UI element)

### 4.2 Cross-Issue Dependencies

Some issues are related. Before fixing ISSUE-046, check if fixing ISSUE-045
first would resolve it automatically. Common dependency patterns:

- CSS issues often share a root cause (one bad layout parent)
- Agent dispatch failures often trace to one broken service
- State management bugs often share a slice mutation issue

If you identify a dependency, note it:
```
⚠️ ISSUE-046 appears to depend on ISSUE-045. Fixing 045 first.
```

### 4.3 Issues You Cannot Fix

Some issues require:
- API key rotation (needs user approval)
- Cloud Function deployment (needs CI/CD)
- Third-party service changes (out of scope)
- Design decisions (needs user input)

For these, update the status to `BLOCKED` with a reason:
```markdown
- **Status:** 🚫 BLOCKED — Requires Cloud Function redeployment
```

### 4.4 Regression Prevention

After fixing an issue, check if a regression test should be added to V7:

1. Is this a critical user-facing bug? → Add to V7
2. Has this issue regressed before? → Definitely add to V7
3. Is the fix in a high-churn area of code? → Add to V7

If adding to V7, append the routine to `MEGA_STRESS_TEST_V7_REGRESSION.md`.

---

## 5. TRIAGE MODE (`/issue triage`)

When invoked as `/issue triage`, do NOT fix anything. Instead:

### 5.1 Read the Full Backlog

```bash
cat .agent/test_ledger/OPEN_ISSUES.md
```

### 5.2 Produce a Triage Report

```markdown
# Issue Triage Report — <DATE>

## Summary
- Total issues: <N>
- OPEN: <N> (🔴 <N> HIGH, 🟡 <N> MEDIUM, 🟢 <N> LOW)
- FIXED: <N>
- BLOCKED: <N>

## Priority Queue (Recommended Fix Order)
1. ISSUE-045: <title> — 🔴 HIGH — <1-line rationale for priority>
2. ISSUE-046: <title> — 🟡 MEDIUM — <1-line rationale>
3. ...

## Dependency Map
- ISSUE-046 depends on ISSUE-045 (shared CSS root)
- ISSUE-047 is independent

## Estimated Effort
- Quick wins (< 30 min): ISSUE-043, ISSUE-046
- Medium effort (1-2 hours): ISSUE-045
- Complex (2+ hours): ISSUE-044

## Recommendation
<1-2 sentences: what to fix first and why>
```

---

## 6. THE FULL SYSTEM LOOP

This is how `/mega`, `/real`, and `/issue` work together as a complete QA system:

```
┌─────────────────────────────────────────────────────┐
│                    THE QA LOOP                       │
│                                                      │
│  ┌──────────┐     ┌──────────────┐     ┌──────────┐ │
│  │  /mega   │────▶│ OPEN_ISSUES  │────▶│  /issue  │ │
│  │  /real   │     │     .md      │     │          │ │
│  │          │     │              │     │          │ │
│  │ (finds   │     │ (the shared  │     │ (reads   │ │
│  │  bugs)   │     │  contract)   │     │  & fixes │ │
│  │          │     │              │     │  bugs)   │ │
│  └──────────┘     └──────────────┘     └──────────┘ │
│       ▲                                      │       │
│       │            VERIFY FIXES              │       │
│       └──────────────────────────────────────┘       │
│                                                      │
│  /mega reruns → confirms FIXED → marks VERIFIED      │
│  /mega reruns → finds regression → reopens issue     │
└─────────────────────────────────────────────────────┘
```

**Status Lifecycle:**
```
OPEN → FIXED (by /issue) → VERIFIED (by /mega on next run)
OPEN → BLOCKED (by /issue, with justification)
OPEN → WONT_FIX (by user decision)
FIXED → OPEN [REGRESSION] (by /mega if fix didn't hold)
```

---

## 7. QUICK REFERENCE

```
/issue                       → Fix all OPEN issues, severity order
/issue 45                    → Fix ISSUE-045 only
/issue 45 46 47              → Fix specific issues
/issue high                  → Fix 🔴 HIGH only
/issue medium                → Fix 🟡 MEDIUM only
/issue low                   → Fix 🟢 LOW only
/issue triage                → Triage report, no fixing
/issue count                 → Quick OPEN count

Input file:
  .agent/test_ledger/OPEN_ISSUES.md          ← Read issues from HERE

Output:
  Code patches in the relevant source files
  Updated statuses in OPEN_ISSUES.md
  New regression routines in V7 (if applicable)
```

---

## 8. ANTI-PATTERNS (DO NOT DO THESE)

| Anti-Pattern | Why It's Wrong |
|-------------|---------------|
| Fixing all issues in one giant commit | Each issue gets its own atomic fix. Easier to revert. |
| Skipping verification after a fix | Every fix must pass typecheck + lint + tests. |
| Deleting issue entries from OPEN_ISSUES.md | Never delete. Only update status. The history is sacred. |
| "Fixing" a UI bug by hiding the element | Address the root cause. Never suppress symptoms. |
| Refactoring an entire file to fix one bug | Surgical precision. Change the minimum lines needed. |
| Ignoring the Error Ledger | Always check `.agent/skills/error_memory/ERROR_LEDGER.md` first. |
| Fixing LOW issues before HIGH issues | Severity order is mandatory unless the user overrides. |
