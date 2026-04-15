---
description: Pre-push CI validation — run all 4 shards locally and audit for known failure patterns before pushing to main
---

# /ci-validate — Pre-Push CI Validation

Run this before any push to `main` that touches test files, service files, or 
UI components. Prevents the class of failures that cause multi-hour CI debugging 
sessions. Each step is fast. All 4 shards take ~2 minutes total on macOS.

---

## Step 1 — Check the Error Ledger First

// turbo
```bash
grep -A 3 "Pattern\|RULE:\|BUG:" .agent/skills/error_memory/ERROR_LEDGER.md | head -60
```

Read the known patterns. If your change touches a service with dynamic imports 
or a component with aria-labels, those patterns apply to you.

---

## Step 2 — Audit for Missing Dynamic Import Mocks

// turbo
```bash
# Find all dynamic import() calls in service files
grep -rn "await import(" packages/renderer/src/services packages/main/src \
  --include="*.ts" --include="*.tsx" | grep -v "node_modules\|__tests__\|test\." | head -30
```

For each `await import('@/some/module')` found in source, verify the corresponding
test file has `vi.mock('@/some/module', ...)`. If not — **add the mock before pushing**.

> **Why this matters:** Vitest hoists `vi.mock()` calls at parse time. A dynamic 
> `import()` inside a function body bypasses this and executes for real in CI, 
> causing timeouts or network errors from mocked environments.

---

## Step 3 — Audit for A11y Test Drift

// turbo
```bash
# Find all a11y test files
find packages -name "*.a11y.test.tsx" | head -20
```

// turbo
```bash
# For each a11y test, extract the aria-label queries and cross-check against source
grep -h "getByRole.*name" packages/renderer/src/core/components/command-bar/PromptArea.a11y.test.tsx \
  packages/renderer/src/modules/*/components/**/*.a11y.test.tsx 2>/dev/null | head -20
```

Compare the queried `name:` patterns against the actual `aria-label=` values in 
the source components. If they don't match — **update the test before pushing**.

> **Why this matters:** Aria-label mismatches produce cryptic `Unable to find 
> role=button with name /pattern/` errors that look nothing like "component 
> refactor broke the test", making them very slow to diagnose.

---

## Step 4 — Run All 4 Shards Locally

Run them in parallel (4 separate terminals or background jobs):

// turbo
```bash
npm test -- --run --reporter=dot --pool=forks --testTimeout=30000 --bail=3 --shard=1/4 &
npm test -- --run --reporter=dot --pool=forks --testTimeout=30000 --bail=3 --shard=2/4 &
npm test -- --run --reporter=dot --pool=forks --testTimeout=30000 --bail=3 --shard=3/4 &
npm test -- --run --reporter=dot --pool=forks --testTimeout=30000 --bail=3 --shard=4/4 &
wait && echo "ALL SHARDS DONE"
```

All 4 must exit 0 before pushing. If any fail:
1. Rerun the failing shard with `--reporter=verbose` to see the full failure
2. Check the Error Ledger for a matching pattern
3. Fix, then re-run only the failing shard to confirm before pushing

---

## Step 5 — Quick Typecheck

// turbo
```bash
npm run typecheck 2>&1 | grep "error TS" | head -10; echo "Exit: $?"
```

Must exit 0. Any `error TS` with a non-zero exit blocks CI.

---

## Step 6 — Push

Only after Steps 4 and 5 both clean:

```bash
git push origin main
```

Then monitor CI with:

// turbo
```bash
sleep 30 && for i in 1 2 3 4 5 6; do
  curl -sL \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/the-walking-agency-det/indiiOS-Clean/actions/runs?branch=main&per_page=3&event=push" \
    2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('workflow_runs', [])[:3]:
    icon = 'OK' if r['conclusion'] == 'success' else ('FAIL' if r['conclusion'] == 'failure' else 'RUN')
    print(icon, r['name'][:30], r['status'], str(r['conclusion']))
"
  sleep 60
done
```

---

## CI Debug Cheatsheet (when a shard fails on CI but not locally)

```bash
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
|---|---|
| `git exit code 128` annotation on unit-test job | Phantom annotation from gitleaks in a prior build job. Not related to your tests. |
| `window.getComputedStyle` not implemented | Expected JSDOM noise. All component tests emit this. Not a failure. |
| `localstorage-file was provided without a valid path` | Electron keytar warning in test env. Harmless. |
| `Real-time sync failed / Fetch failed` | Expected stderr from mocked services. Not a failure. |
