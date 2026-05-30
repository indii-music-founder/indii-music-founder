---
description: >-
  End-to-end issue sweep — branch uncommitted work → fix all CodeRabbit and Sentry issues →
  validate → generate the next Regression Gauntlet mega test plan → execute it via /mega-test →
  report. A complete closed-loop quality cycle. Run after any significant block of work.
---

// turbo-all

# /issue-sweep — The End-to-End Issue Sweep Protocol

> **Distilled from:** A full session covering: branching uncommitted work, fetching and fixing
> 10 CodeRabbit review comments across 2 PRs (#1707 and #1703), running typecheck + lint,
> committing all fixes, generating Mega Stress Test V4.0 (35 targeted regression routines), and
> executing all routines against the live application using the browser subagent.
>
> **This is a closed loop.** It ends with browser-verified proof that every fix held.
> Run at the end of any sprint, after merging large PRs, or before a release seal.

---

## Prerequisites

- You must have a clean or partially-dirty working tree (uncommitted changes are handled in Phase 1).
- `GITHUB_TOKEN` and `SENTRY_TOKEN` must be set in `.env`.
- The `OPEN_ISSUES.md` ledger must exist at `.agent/test_ledger/OPEN_ISSUES.md`.
- The most recent Mega Stress Test plan must exist at `.agent/test_ledger/MEGA_STRESS_TEST_V*.md`.

---

## Phase 1: Capture & Branch Uncommitted Work

### Step 1 — Assess the working tree

// turbo
```bash
git status --short && git branch --show-current
```

Summarize what is uncommitted. If the working tree is clean, skip to Phase 2.

### Step 2 — Create a new branch and commit all uncommitted work

Determine an appropriate branch name based on the staged files (e.g., `chore/test-ledger-updates`,
`fix/open-issues-sweep`). Then:

```bash
git checkout -b <branch-name> && git add -A && git commit -m "chore: capture uncommitted work before issue sweep" && git push -u origin <branch-name>
```

> **Rule:** Never sweep against a dirty `main`. Isolate first, fix second.

---

## Phase 2: Sentry Issue Sweep

### Step 3 — Fetch unresolved Sentry issues

// turbo
```bash
export $(grep -v '^#' .env | xargs 2>/dev/null)
curl -s -H "Authorization: Bearer $SENTRY_TOKEN" \
  "https://sentry.io/api/0/organizations/thewalkingagency/issues/?query=is:unresolved&limit=25" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
if isinstance(d, list) and len(d) > 0:
    for i in d:
        print('ID:', i.get('id'))
        print('Title:', i.get('title'))
        print('Level:', i.get('level'))
        print('Culprit:', i.get('culprit'))
        print('Last:', i.get('lastSeen'))
        print('---')
else:
    print('No unresolved issues or empty response.')
"
```

### Step 4 — Fix each Sentry issue

For each issue returned:
1. Read the culprit file using `view_file`.
2. Analyze the stack trace in the Sentry issue body.
3. Apply the fix using `replace_file_content` or `multi_replace_file_content`.
4. Log the fix: add a new `ISSUE-NNN` entry to `OPEN_ISSUES.md` marked `✅ FIXED`.

If Sentry returns zero issues, note "Sentry: clean slate ✅" and proceed.

---

## Phase 3: CodeRabbit PR Comment Sweep

### Step 5 — Fetch all recent PRs (open + recently closed)

// turbo
```bash
export GITHUB_TOKEN="$(grep '^GITHUB_TOKEN=' .env | cut -d= -f2)"
curl -s -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/the-walking-agency-det/indii-Clean/pulls?state=all&per_page=10" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for p in d:
    print('PR#' + str(p['number']), p['state'], p['title'][:70])
"
```

### Step 6 — Fetch CodeRabbit inline review comments from each PR

For each PR number discovered in Step 5 (focus on the 5 most recent):

```bash
curl -s -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/the-walking-agency-det/indii-Clean/pulls/<PR_NUMBER>/comments?per_page=100" \
  | python3 -c "
import sys, json
comments = json.load(sys.stdin)
cr = [c for c in comments if 'coderabbit' in c.get('user',{}).get('login','').lower()]
print(len(cr), 'CodeRabbit comments')
for c in cr:
    print('FILE:', c.get('path'))
    print('LINE:', c.get('line') or c.get('original_line'))
    print(c['body'][:1000])
    print('---')
"
```

Also fetch the top-level review body for each PR:

```bash
curl -s -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/the-walking-agency-det/indii-Clean/pulls/<PR_NUMBER>/reviews" \
  | python3 -c "
import sys, json
reviews = json.load(sys.stdin)
cr = [r for r in reviews if 'coderabbit' in r.get('user',{}).get('login','').lower()]
for r in cr:
    print('State:', r['state'])
    print(r['body'][:500])
"
```

### Step 7 — Apply all actionable CodeRabbit fixes

Triage each comment by severity (`🔴 Critical`, `🟠 Major`, `🟡 Minor`):

- **Critical/Major:** Fix immediately. Read the current file state first with `view_file`, then apply.
- **Minor:** Fix if it takes < 5 minutes. Document and skip if it requires a larger refactor.
- **Informational/Discussion:** Note but do not apply code changes.

For each fix applied:
1. View the current file with `view_file` to confirm the issue still exists before fixing.
2. Apply with `replace_file_content` or `multi_replace_file_content`.
3. Keep a running list of fixes: `FILE | LINE | ISSUE | FIX APPLIED`.

**Common CodeRabbit pattern fixes for this codebase:**

| Pattern | Fix |
|---------|-----|
| `browser.close()` outside `finally` | Wrap in `try/finally`, add `process.exitCode = 1` on catch |
| `waitForTimeout()` usage | Replace with `waitForLoadState('networkidle')` (Playwright) or `waitForNetworkIdle()` (Puppeteer) |
| `refCount` incremented without decrement on cache-hit path | Add `try/finally` on hit path to decrement + evict |
| Sequential queue serializing unrelated async tasks | Remove queue; let unrelated tasks run concurrently |
| Missing shape validation in tool schemas | Add `if (!requiredField) return toolError(...)` before shape creation |
| `riskTier: 'read'` on write-capable agent actions | Change to `riskTier: 'write'` |
| Toast assertions outside `waitFor` | Move assertions inside same `waitFor` block |
| `text-[10px]` in UI components | Replace with `text-xs opacity-80` (12px, accessible) |

---

## Phase 4: Validate All Fixes

### Step 8 — Run TypeScript typecheck

```bash
npm run typecheck 2>&1 | tail -20
```

Exit code must be `0`. If not, fix the type errors before proceeding. Do NOT skip validation.

### Step 9 — Run ESLint

```bash
npm run lint 2>&1 | tail -20
```

All lint errors must be resolved. Warnings are acceptable but document them.

### Step 10 — Commit all fixes with a structured message

```bash
git add <files...> && git commit -m "fix(sweep): resolve Sentry and CodeRabbit issues

- <brief description of each fix, one line per fix>
- Validated: typecheck ✅ lint ✅"
```

Then push:

```bash
git push
```

---

## Phase 5: Generate the Next Regression Gauntlet

### Step 11 — Read the OPEN_ISSUES ledger in full

```bash
cat .agent/test_ledger/OPEN_ISSUES.md
```

Parse all issues. Build two lists:
- **Fixed this sweep:** Issues that were OPEN and are now FIXED (from Phases 2 + 3).
- **Previously fixed:** All prior `✅ FIXED` issues.
- **Still open:** All `OPEN` or `OPEN (INVESTIGATION)` issues.

### Step 12 — Determine the next version number

```bash
ls .agent/test_ledger/MEGA_STRESS_TEST_V*.md | sort -V | tail -1
```

The next version is the highest found version + 1. (e.g., if V4 exists, create V5.)

### Step 13 — Read all prior mega test plans for format reference

```bash
cat .agent/test_ledger/MEGA_STRESS_TEST_PLAN.md
cat .agent/test_ledger/MEGA_STRESS_TEST_V2_PLAN.md
cat .agent/test_ledger/MEGA_STRESS_TEST_V3_TOOLS.md
```

The new plan must follow this structure:

```
# Mega Stress Test Plan vN.0 (<Thematic Title>)

<One paragraph description of this version's focus>

## Section 1: <Theme> (ISSUE-XXX–YYY)
<Routine N+1>. **<Title> (ISSUE-XXX):** <Precise steps to reproduce the scenario,
     what to verify, what constitutes pass vs. fail.>

...

## Pass/Fail Criteria
| Result | Definition |
...

## Execution Notes
- Run against production build AND dev build separately.
- Console errors are disqualifying for <specific sections>.
- For any ❌ FAIL, add a REGRESSION entry to OPEN_ISSUES.md.
- Chaos Finale: combine routines <A>, <B>, <C> simultaneously for 5 minutes.
```

### Step 14 — Generate the new mega test plan

Rules for test plan generation:
1. **Every newly fixed issue** (from this sweep AND recent prior fixes) gets at least one regression test routine.
2. **Open issues** get "OPEN" labeled verification routines — document current state regardless.
3. **CodeRabbit hardening fixes** get dedicated routines testing the exact boundary condition CR found.
4. **Routines must be actionable** — a human or browser subagent must be able to execute each one without further clarification.
5. **Route numbering** continues from the last test in the previous version (e.g., if V4 ends at 135, V5 starts at 136).
6. **Section themes** should logically group issues (delegation & seating, model armor, UI/layout, concurrency, remote relay, workflow, etc.).

Save to:
```
.agent/test_ledger/MEGA_STRESS_TEST_V<N>_<THEME>.md
```

### Step 15 — Commit the new test plan

```bash
git add .agent/test_ledger/MEGA_STRESS_TEST_V<N>_*.md && \
git commit -m "docs(test): add Mega Stress Test v<N>.0 — <Thematic Title> (Routines <X>-<Y>)" && \
git push
```

---

## Phase 6: Update OPEN_ISSUES.md

### Step 16 — Mark newly fixed issues

For each issue fixed in this sweep, update its status line in `OPEN_ISSUES.md`:

```diff
- - **Status:** OPEN
+ - **Status:** ✅ FIXED (sweep: <date> — <brief description>)
```

### Step 17 — Commit the ledger update

```bash
git add .agent/test_ledger/OPEN_ISSUES.md && \
git commit -m "docs(issues): update OPEN_ISSUES ledger after issue sweep" && \
git push
```

---

## Phase 7b (Optional): Generate E2E Playwright Spec

If the fixes involved new behavioral contracts (e.g., a resource-leak fix, a validation boundary,
a governance riskTier change), generate a Playwright E2E spec to permanently lock the behavior.

### Step 17b — Create spec file

Create a new file at `e2e/mega-stress-test-vN.spec.ts`. It should:

1. Import `test` and `expect` from `@playwright/test`.
2. Group tests by section matching the mega test plan sections.
3. For each `❌ FAIL` or `⚠️ PARTIAL` routine found during execution (Phase 8), add a `test.skip()` block noting the open issue number — this makes regressions visible in CI.
4. For each `✅ PASS` routine, write a lightweight smoke test covering the PASS condition.

Minimal spec skeleton:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Mega Stress Test V<N> — <Title>', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4242');
    await page.waitForLoadState('networkidle');
  });

  // Section 1: <Theme>
  test('Routine <N>: <Title> (ISSUE-XXX regression)', async ({ page }) => {
    // <PASS condition translated into Playwright assertions>
    await page.locator('<selector>').click();
    await expect(page.locator('<result>')).toBeVisible();
  });

  // Skipped until ISSUE-NNN is resolved
  test.skip('Routine <N>: <Title> — OPEN ISSUE-NNN', async () => {});
});
```

Commit the spec:

```bash
git add e2e/mega-stress-test-vN.spec.ts && \
git commit -m "test(e2e): add Playwright spec for Mega Stress Test V<N>" && \
git push
```

---

## Phase 8: Execute the New Test Plan (Closed Loop)

This is the proof step. Do not skip it. The sweep is not complete until the newly generated
test plan has been executed and its results have confirmed the fixes held.

### Step 18 — Invoke /mega-test on the new plan

Read `.agent/workflows/mega-test.md` and follow that workflow exactly, targeting the
newly created plan version:

```
/mega-test v<N>
```

The `/mega-test` workflow will:
1. Confirm the dev server is running at `localhost:4242`.
2. Execute each routine using the browser subagent (5–10 routines per call).
3. Record PASS / PARTIAL / FAIL / OPEN per routine.
4. File any new regressions to `OPEN_ISSUES.md` as `[REGRESSION]` entries.
5. Produce a test execution report artifact.

**Minimum acceptable result:** Zero `❌ FAIL [REGRESSION]` verdicts.
Any newly discovered bugs (not regressions) are logged as OPEN and deferred to next sweep.

### Step 19 — Append to REAL_TEST_HISTORY.md

```bash
echo "## $(date +%Y-%m-%d) — issue-sweep + Mega Test V<N> — <PASS>✅ <FAIL>❌ <NEW> new issues" >> .agent/test_ledger/REAL_TEST_HISTORY.md
git add .agent/test_ledger/REAL_TEST_HISTORY.md && git commit -m "docs: update test history after issue-sweep" && git push
```

---

## Phase 9: Final Report

### Step 20 — Produce the full sweep + test summary

```
## Issue Sweep Report — <date>

### Sentry
- Status: <clean / N issues fixed>
- Issues fixed: <list>

### CodeRabbit
- PRs scanned: <list of PR numbers>
- Comments actioned: <N of M total>
- Files modified: <list>
- Fixes applied:
  | File | Issue | Severity | Fix |
  |------|-------|----------|-----|
  | ...  | ...   | ...      | ... |

### Validation
- typecheck: ✅ / ❌
- lint: ✅ / ❌

### Test Plan Generated
- Version: V<N>.0 — <Title>
- Routines: <X>–<Y> (<count> total)
- File: .agent/test_ledger/MEGA_STRESS_TEST_V<N>_*.md

### Test Execution Results
- Routines run: <N>
- PASS: <N> | PARTIAL: <N> | FAIL: <N> | REGRESSION: <N>
- New issues filed: ISSUE-NNN through ISSUE-MMM

### OPEN_ISSUES Ledger
- Issues newly fixed: <N>
- Issues still open: <N>
- Total issues tracked: <N>

### Git
- Branch: <branch-name>
- Commits: <N>
- Status: pushed ✅
- Ready for PR: YES / NO (if regressions exist, NO)
```

---

## Completion Criteria

The sweep is **complete** when ALL of the following are true:

| Criterion | Status |
|-----------|--------|
| Uncommitted work captured on a named branch | ✅ |
| Sentry: zero unresolved issues (or all actioned) | ✅ |
| CodeRabbit: all Critical/Major comments fixed | ✅ |
| `typecheck` passes (exit 0) | ✅ |
| `lint` passes (exit 0) | ✅ |
| All fixes committed and pushed | ✅ |
| New Mega Stress Test version generated and committed | ✅ |
| `/mega-test` executed — zero REGRESSION verdicts | ✅ |
| `OPEN_ISSUES.md` updated with new fix statuses | ✅ |
| `REAL_TEST_HISTORY.md` updated | ✅ |
| Sweep + test report produced | ✅ |

> **When all criteria are met, the sweep is sealed.** 🧹
> The branch is production-ready. Open a PR or merge to `main`.

---

## Workflow Relationships

```
/issue-sweep  ──────────────────────────────────────────────────────────┐
│                                                                        │
│  Phase 1: Branch uncommitted work                                      │
│  Phase 2: Fix Sentry issues                                            │
│  Phase 3: Fix CodeRabbit PR comments                                   │
│  Phase 4: Validate (typecheck + lint)                                  │
│  Phase 5: Generate next Mega Stress Test plan ──→ MEGA_STRESS_TEST_VN  │
│  Phase 6: Update OPEN_ISSUES.md ledger                                 │
│  Phase 7b: Generate E2E Playwright spec (optional)                     │
│  Phase 8: /mega-test vN ──→ browser execution of all new routines      │
│  Phase 9: Final sweep + test report                                    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

Related workflows:
  /mega-test   → Execute a specific test plan version using browser subagent
  /real        → Freeform real-user scenario testing (discovery mode)
  /1percent    → Production seal — repo metadata, CI, branch protection
  /auto-fix    → Lightweight version of Phase 2+3 only (no test plan)
  /ci-validate → Run all 4 test shards locally before pushing to main
```
