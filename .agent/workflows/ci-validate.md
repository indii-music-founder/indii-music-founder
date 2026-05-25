---
description: Comprehensive pre-push CI validation with commit consolidation to prevent bloat. Auto-fix issues, run full bug scan, consolidate excessive commits, then execute all 4 test shards locally.
---

# /ci-validate — Pre-Push CI Validation (Enhanced)

// turbo-all

Integrated five-phase validation before any push to `main`:

0. **Checkpoint & Commit Audit Phase** — Validate distributed agent checkpoints + detect commit bloat
1. **Auto-Fix Phase** — Fix Sentry issues + CodeRabbit comments
2. **Hunter Phase** — Full-spectrum bug/security scan
3. **CI Phase** — Run all 4 shards + typecheck + lint
4. **Final Verification** — Typecheck, build, tests all pass

Prevents commit bloat cascades, checkpoint conflicts, and multi-hour CI debugging sessions.

**Note:** Even if you forget `/opp`, this workflow validates the checkpoint system upfront.

---

## Step 0 — Checkpoint & Commit Audit (CRITICAL)

### 0.1 — Distributed Checkpoint Validation

**Verify the distributed agent checkpoint system is being used correctly:**

```bash
# Check if checkpoints directory exists and has agent files
if [ ! -d ".agent/checkpoints" ]; then
  echo "ERROR: .agent/checkpoints directory missing. Run migration per HANDOFF_STRATEGY.md"
  exit 1
fi

# List all agent checkpoints
echo "=== Agent Checkpoints ==="
ls -lh .agent/checkpoints/*.md 2>/dev/null || echo "WARNING: No agent checkpoints found"

# Check for deprecated singleton handoff file with conflicts
if grep -q "^<<<<<<< HEAD" .agent/HANDOFF_STATE.md 2>/dev/null; then
  echo "ERROR: .agent/HANDOFF_STATE.md still has merge conflicts"
  echo "This file is deprecated. Use distributed checkpoints in .agent/checkpoints/ instead"
  echo "See: .agent/HANDOFF_STRATEGY.md for migration steps"
  exit 1
fi

# Warn if old singleton file was modified recently
if [ -f ".agent/HANDOFF_STATE.md" ]; then
  MODIFIED=$(git log -1 --format=%ai .agent/HANDOFF_STATE.md 2>/dev/null | cut -d' ' -f1)
  echo "WARNING: Old .agent/HANDOFF_STATE.md still exists (last modified: $MODIFIED)"
  echo "Consider migrating to distributed checkpoints: .agent/checkpoints/*.md"
fi
```

**IF checkpoint validation fails:**

- Missing `checkpoints/` directory → Follow migration in `.agent/HANDOFF_STRATEGY.md`
- Merge conflicts in old file → Resolve per Step 0.2 below
- No agent checkpoints found → Ensure agents are writing to `.agent/checkpoints/{agent-id}.md` on session end

### 0.2 — Commit Audit & Consolidation

**Check for commit bloat:**

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

**Unified CI Steps:**
1. **Duplicate Identifier Check:** Scans `appSlice.ts` for duplicate identifiers.
2. **Missing Electron Mocks Check:** Ensures all main-process tests correctly mock Electron via `vi.mock('electron')`.
3. **TypeScript Typecheck:** Executes `npm run typecheck` across all workspace targets.
4. **Flowchart Syntax & Sanity Check:** Executes `node scripts/validate-flowcharts.js` to ensure all architectural flowcharts under `docs/flowcharts/` contain valid headers, Mermaid blocks, transition breakdowns, and safe syntax.
5. **Sharded Unit Tests:** Runs all unit test suites in parallel across 4 sharded runners (`shard=1/4` to `4/4`).

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

---

## Checkpoint Validation Checklist

**Run this before pushing to ensure no conflicts occur:**

```bash
# Quick validation (can be run without full /ci-validate)
bash << 'VALIDATE'
echo "=== Checkpoint System Validation ==="

# 1. Check directory exists
[ -d ".agent/checkpoints" ] && echo "✓ Checkpoints directory exists" || echo "✗ Missing .agent/checkpoints"

# 2. Check for recent agent checkpoints
RECENT=$(find .agent/checkpoints -name "*.md" -mtime -1 2>/dev/null | wc -l)
echo "✓ Recent agent checkpoints: $RECENT"

# 3. Check for merge conflicts in old file
if grep -q "<<<<<<< HEAD" .agent/HANDOFF_STATE.md 2>/dev/null; then
  echo "✗ CONFLICT in HANDOFF_STATE.md — use distributed checkpoints instead"
else
  echo "✓ No conflicts in HANDOFF_STATE.md"
fi

# 4. Check commit count
COMMITS=$(git rev-list --count main..HEAD)
if [ "$COMMITS" -gt 10 ]; then
  echo "⚠ WARNING: $COMMITS commits ahead of main (recommend consolidation)"
else
  echo "✓ Commit count acceptable ($COMMITS)"
fi

VALIDATE
```

If any checks fail:

- **Missing directory** → Create: `mkdir -p .agent/checkpoints && touch .agent/checkpoints/.gitkeep`
- **Merge conflict** → Resolve using distributed checkpoint protocol in `.agent/HANDOFF_STRATEGY.md`
- **Too many commits** → Run Step 0.2 consolidation before proceeding
