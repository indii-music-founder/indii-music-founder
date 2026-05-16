---
description: Comprehensive pre-push CI validation — auto-fix issues, run full bug scan, then execute all 4 test shards locally before pushing to main
---

# /ci-validate — Pre-Push CI Validation (Enhanced)

// turbo-all

Integrated three-phase validation before any push to `main` that touches test files, service files, or UI components:

1. **Auto-Fix Phase** — Fix Sentry issues + CodeRabbit comments
2. **Hunter Phase** — Full-spectrum bug/security scan
3. **CI Phase** — Run all 4 shards + typecheck + lint

Prevents the class of failures that cause multi-hour CI debugging sessions.

---

## Step 1 — Run Auto-Fix (From `.agent/workflows/auto-fix.md`)

Before running deeper validation, clean up known fixable issues. The agent MUST automatically execute the `/auto-fix` protocol:

1. Fetch active Sentry issues and apply fixes.
2. Fetch GitHub PR comments from CodeRabbit and apply fixes.
3. Run `npm run typecheck && npm run lint` to verify stability.
4. Commit if any fixes were made.

*Note for agent: read and follow `.agent/workflows/auto-fix.md` inline here.*

---

## Step 2 — Run Hunter Phase (From `.agent/workflows/hunter.md`)

After auto-fixes, run the full-spectrum bug hunt. This covers:

- **Phase 1: Big Game** — Security vectors (XSS, hardcoded secrets, process.env), memory leaks, loading state traps, swallowed errors, HTTP error codes, vendor chunk conflicts, impure render functions
- **Phase 2: Small Game** — Store/state logic, race conditions, finance rounding, AI service limits, locale issues
- **Phase 3: Verify** — Typecheck, vitest, build, Cloud Functions, Firestore rules

*Note for agent: execute the full Hunter workflow from `.agent/workflows/hunter.md` inline here. Do NOT skip phases. Auto-fix all findings, verify, and commit.*

---

## Step 3 — Run Unified CI Validation Script

```bash
npm run ci
```

If the script fails, **the agent MUST analyze the output and fix the code** before completing the workflow.

---

## Step 4 — Check the Error Ledger (If failures occur)

If `npm run ci` reveals failures, read the known patterns to find solutions:

```bash
cat .agent/skills/error_memory/ERROR_LEDGER.md | head -60
```

Read the known patterns. If your change touches a service with dynamic imports, a component with aria-labels, or any of the Hunter categories, those patterns apply.

---

## Step 5 — CI Debug Cheatsheet (when a shard fails on CI but not locally)

```text
# 1. Find the failing job ID
curl -sL -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/new-detroit-music-llc/indii-Clean/actions/runs/{RUN_ID}/jobs?per_page=20" \
  | python3 -c "import sys,json; [print('FAIL', j['name'], j['id']) for j in json.load(sys.stdin)['jobs'] if j['conclusion']=='failure']"

# 2. Get annotations (the real error, not the phantom git/gitleaks warning)
curl -sL -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/new-detroit-music-llc/indii-Clean/check-runs/{JOB_ID}/annotations" \
  | python3 -c "import sys,json; [print(a['annotation_level'], a['path'], a['start_line'], a['message'][:300]) for a in json.load(sys.stdin)]"

# 3. IGNORE annotations where message contains 'git' and path='.github' — those are phantom
# 4. The real failure is in the 'Process completed with exit code 1' annotation's line number
#    which maps to the test reporter output in the CI log
```

---

## Known False Alarms (do NOT investigate these)

| Symptom | Why it's a false alarm |
| --- | --- |
| `git exit code 128` annotation on unit-test job | Phantom annotation from gitleaks in a prior build job. Not related to your tests. |
| `window.getComputedStyle` not implemented | Expected JSDOM noise. All component tests emit this. Not a failure. |
| `localstorage-file was provided without a valid path` | Electron keytar warning in test env. Harmless. |
| `Real-time sync failed / Fetch failed` | Expected stderr from mocked services. Not a failure. |
| `Keeper_Persistence.test.ts > should persist... expected vi.fn() to be called at least once` | Shard-ordering isolation flakiness. Passes immediately when run alone (`npm test -- --run Keeper_Persistence`). Pre-existing, not caused by your changes. |
| `test: FAILURE` shown on a PR that is marked `MERGEABLE` | Stale CI status from a previous run. GitHub recomputed overall mergeability from the latest run. Safe to merge if the **latest** run for that branch is `success`. Verify with `gh run list --branch <branch>`. |
