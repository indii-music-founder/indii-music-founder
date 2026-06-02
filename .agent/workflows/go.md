---
description: Universal drop-anywhere recursive loop for progress review, unsticking agents, and task continuation. Auto-detects completion magic phrase and triggers ci-validate.
---

# /go - Recursive Execution Loop (Enhanced)

**Activates a self-reflective execution loop for progress review, unsticking blocked agents, and driving tasks to completion.**

**Completion Signal:** When the agent determines all tracked work is complete and verified, automatically invoke `/ci-validate`.

## 1. Context & Scan (MANDATORY)

**Execute tools in parallel (// turbo):**

- `git status` — Check repo safety
- Read the active task ledger in this order: current user objective/thread goal, `.agent/artifacts/task.md`, then root `task.md` only if it clearly matches the current goal.
- Read the active implementation plan in this order: current user objective/thread goal, `.agent/artifacts/implementation_plan.md`, then root `implementation_plan.md` only if it clearly matches the current goal.
- Read `.agent/skills/error_memory/ERROR_LEDGER.md` — Inject CI-breaking pattern awareness
- **Audit:** Re-read ALL user prompts. Check: Acknowledged? Implemented? Verified?
- **Stale Ledger Guard:** If `task.md` or `implementation_plan.md` describes an unrelated old task, do not use it as the source of truth. State that it is stale and proceed from the current user objective plus current worktree evidence.

## 1.5 Preventative Maintenance (Pattern Detection)

Watch for these CI-breaking patterns from ERROR_LEDGER:

- Duplicate identifiers from mass squashes
- Missing `vi.mock` for dynamic imports or Electron modules
- A11y test assertions drifting from component source
- Missing `.catch()` on async ops causing silent canvas/component failures
- Agent routing typos in prompts
- Type errors from incomplete refactors
- **Self-Fulfilling Tests:** Ensure unit tests assert the *global system contract*, not just the local function's broken output. Do not change a test just to make it pass without verifying the architectural contract.

## 2. Stuck Agent Detection

If agent reports being stuck, blocked, or unable to proceed:

1. **Parse Blocker:** Identify the specific blocker (missing file? Type error? Permission? API error?)
2. **Check ERROR_LEDGER:** Search for matching pattern
3. **Apply Known Fix:** If pattern found, apply documented solution
4. **Escalate:** If blocker is novel, document it, apply safest fix, and update ERROR_LEDGER
5. **Retry:** Re-attempt the operation with fix applied

## 3. State Snapshot (Output)

**Output this before each iteration:**

```markdown
### Go Loop — Iteration [N]
- **Goal:** [Summary]
- **Status:** [X% / N/M tasks complete]
- **Current Task:** [Name or "None if all done"]
- **Blockers:** [List or None]
- **Next Action:** [Tool + exact target]
```

## 4. Re-evaluation Logic

- **Success Standard:** Compare delivered vs. promised.
- **Three-Strike Rule:** If fixing the SAME issue fails 3x, **STOP** and request user help.
- **Max Recursion Depth:** If `/go` called >12x within a session, **STOP** and ask for scope review.
- **Strategy Failure:** Update `implementation_plan.md` immediately if approach fails.
- **Completion Detection:** If the agent says work is done, verify against the active objective and invoke `/ci-validate`.

## 5. Execution Loop (Single Task Per Iteration)

**For each `/go` invocation, complete exactly ONE task:**

1. **Select Task Priority:** Blockers > Dependencies > User Priority
2. **Execute Task:** Write code, update tests, verify (typecheck/build as needed)
3. **Execution Integrity Check:** You CANNOT mark a task complete `[x]` if its implementation relies on a hardcoded string, a `TODO`, or a `[MOCK]` comment (unless the task explicitly requested a mock).
4. **Verify Locally:** Ensure changes don't break adjacent code
5. **Elevation Pass (via `/better`):** Run the `/better` command on the specific files you just modified to audit for structural integrity, performance, and defensive resilience *before* moving on.
6. **Mark Complete:** Update the active task ledger with `[x]` checkbox. If no matching ledger exists, summarize completion evidence in the final response instead of editing an unrelated stale file.
7. **Commit:** `git add -A && git commit -m "<type>: <description>"` (conventional format)
8. **Loop or Exit:**
   - If tasks remain: re-invoke `/go`
   - If all tasks done: move to Final Verification

## 6. Unsticking Protocol (When Agent Reports Blocked)

**If agent cannot proceed on a task:**

1. **Isolate Blocker:** Identify exact error/issue (type error? File missing? Logic problem?)
2. **Check ERROR_LEDGER:** Search `.agent/skills/error_memory/ERROR_LEDGER.md` for matching pattern
3. **Apply Fix:**
   - If found: Apply documented solution verbatim
   - If novel: Propose safest minimal fix, test locally, document for ledger
4. **Re-attempt Task:** Retry with fix applied
5. **If Still Stuck:** After 3x attempts, call user with detailed blocker description

## 7. Final Verification (The Gauntlet)

**Only when all tasks complete. All MUST pass:**

1. `npm run typecheck` — 0 errors
2. `npm run build:studio` — Success
3. Test suite — All pass (`npm test -- --run`)
4. Code audit — No orphaned `TODO`/`FIXME` comments
5. Git state — Clean (`git status`)

## 8. Completion & Auto-Trigger

**When ALL tasks are done, ALL user prompts are addressed, and Final Verification passes, invoke `/ci-validate` automatically.**

`/ci-validate` runs:

- Auto-fix phase (Sentry + CodeRabbit cleanup)
- Hunter phase (full bug scan)
- Unified CI script (all 4 shards)
- Error ledger check

---

## Quick Reference: When to Use `/go`

| Scenario | Action |
| --- | --- |
| Agent reports being stuck | `/go` (triggers Stuck Agent Detection) |
| Agent says they're done | `/go` verifies the active objective and invokes `/ci-validate` |
| You want to verify progress mid-task | `/go` (outputs State Snapshot for inspection) |
| Need multi-task completion loop | `/go` (one task per invocation, recursive) |
| Want to unstick and push through blockers | `/go` (Error Ledger + fix protocol) |
