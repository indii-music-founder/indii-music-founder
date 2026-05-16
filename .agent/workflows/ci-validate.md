---
description: Comprehensive pre-push CI validation with commit consolidation to prevent bloat. Auto-fix issues, run full bug scan, consolidate excessive commits, then execute all 4 test shards locally.
---

# /ci-validate — Pre-Push CI Validation (Enhanced)

// turbo-all

Integrated four-phase validation before any push to `main`:

1. **Commit Audit Phase** — Detect and consolidate excessive commits (>10 commits on this branch)
2. **Auto-Fix Phase** — Fix Sentry issues + CodeRabbit comments
3. **Hunter Phase** — Full-spectrum bug/security scan
4. **CI Phase** — Run all 4 shards + typecheck + lint

Prevents commit bloat cascades and the multi-hour CI debugging sessions they cause.

---

## Step 0 — Commit Audit & Consolidation (CRITICAL)

**Before any validation, check for commit bloat:**

```bash
# Count commits on this branch vs main
BRANCH_COMMITS=$(git rev-list --count main..HEAD)
echo "Commits ahead of main: $BRANCH_COMMITS"
```

**IF commit count > 10:**

This indicates excessive churn from parallel agent work. The branch is at risk of CI failure cascades.

**ACTION: Consolidate commits by squashing into logical groups:**

1. **Identify commit groups** by purpose (feature, fix, refactor, docs, chore)
2. **Squash related commits** using `git rebase -i main` (interactive rebase)
3. **Create clean commit message** per Conventional Commits (feat, fix, chore, etc.)
4. **Force-push the consolidated branch** (only safe when multiple agents coordinate): `git push --force-with-lease origin $(git branch --show-current)`

**IMPORTANT:** This step prevents cascading CI failures from commit bloat. If you have 100+ commits from parallel agent work, CI will struggle to isolate which commit caused the failure. Consolidation is mandatory.

**After consolidation, verify:**

```bash
git log main..HEAD --oneline | head -20
# Should show ~5-15 clean, atomic commits (not 50+)
```

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

---

## Multi-Agent Parallel Work Protocol

**When working with multiple agents simultaneously (Claude Code + Antigravity agents):**

1. **Establish Commit Discipline:** Each agent commits atomically (one feature = one commit, not one per micro-fix)
2. **Use Feature Branches:** Each agent or task cluster gets its own branch to isolate work
3. **Coordinate Merge Points:** Before `/ci-validate`, consolidate commits to prevent bloat (Step 0)
4. **Avoid Churn Cycles:** If the same file is being fixed repeatedly, stop and let one agent fix it end-to-end
5. **CI as Checkpoint:** `/ci-validate` should run cleanly FIRST TIME after consolidation. If you're running it 3+ times to fix the same issue, the parallel work strategy needs adjustment

**Root Cause of 2-Day CI Debug Cycles:**

- Multiple agents each commit fixes (10+ commits)
- CI fails on commit #5, but you don't know which one
- You ask Agent A to fix, Agent A makes 5 more commits
- Agent B (in Antigravity) also makes 5 commits to "fix" the same thing
- Now there are 20+ commits and 3 contradictory fixes applied
- CI still fails because the root cause was commit #2, but it's buried

**SOLUTION:** Commit consolidation in Step 0 prevents this. Always run it.
