---
description: Pre-push CI validation — run all 4 shards locally and audit for known failure patterns before pushing to main
---

# /ci-validate — Pre-Push CI Validation

// turbo-all

Run this before any push to `main` that touches test files, service files, or
UI components. Prevents the class of failures that cause multi-hour CI debugging
sessions.

This workflow has been upgraded to run automatically. By invoking this workflow, the agent will execute the consolidated `scripts/ci.sh` validation script, which includes duplicate identifier checks, missing electron mock audits, typechecking, and sharded test runs.

---

## Step 1 — Run Auto-Fix

Before running local CI checks, ensure all active Sentry issues and open CodeRabbit PR comments are resolved by invoking the `/auto-fix` workflow.

As part of this `// turbo-all` run, the agent MUST automatically execute the `/auto-fix` protocol first:

1. Fetch active Sentry issues and apply fixes.
2. Fetch GitHub PR comments from CodeRabbit and apply fixes.
3. Commit and push the auto-fixes if any were made.

*Note for agent: read and follow `.agent/workflows/auto-fix.md` inline here.*

---

## Step 2 — Run Unified CI Validation Script

```bash
npm run ci
```

If the script fails, **the agent MUST analyze the output and fix the code** before completing the workflow.

---

## Step 3 — Check the Error Ledger (If failures occur)

If `npm run ci` reveals failures, read the known patterns to find solutions:

```bash
cat .agent/skills/error_memory/ERROR_LEDGER.md | head -60
```

Read the known patterns. If your change touches a service with dynamic imports
or a component with aria-labels, those patterns apply to you.

---

## CI Debug Cheatsheet (when a shard fails on CI but not locally)

```text
# 1. Find the failing job ID
curl -sL -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/the-walking-agency-det/indiiOS-Clean/actions/runs/{RUN_ID}/jobs?per_page=20" \
  | python3 -c "import sys,json; [print('FAIL', j['name'], j['id']) for j in json.load(sys.stdin)['jobs'] if j['conclusion']=='failure']"

# 2. Get annotations (the real error, not the phantom git/gitleaks warning)
curl -sL -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/the-walking-agency-det/indiiOS-Clean/check-runs/{JOB_ID}/annotations" \
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
