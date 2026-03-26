---
name: go
description: Universal recursive execution loop for indiiOS. Reviews progress, re-evaluates strategy, and drives task completion to verified, shipping state. Invoke as /go or @go.md at any point during a session.
---

# @go — Recursive Execution Loop (v2)

## Purpose

A self-reflective execution engine that prevents getting stuck, ensures all user prompts are acknowledged, and drives tasks from start to verified completion. Use this when you want the agent to keep moving autonomously.

## When to Invoke

- After a work order or `implementation_plan.md` is approved and you want hands-free execution
- When the agent has lost track of the broader goal
- When multiple tasks are in flight and you want a checkpoint
- At the start of a new session to resume prior context

---

## Step 1 — Context & Scan (MANDATORY, always run first)

```bash
# Always run these immediately — in parallel
view_file("task.md")                       # [x] done / [/] in progress / [ ] pending
git status && git log -n 3 --oneline       # Clean working state?
```

Also scan for **work order documents** (the source of truth for what to build):

```bash
ls docs/PRODUCTION_WORK_ORDER*.md          # Phase 1 + Phase 2 work orders
view_file("implementation_plan.md")        # If one exists
```

Also **re-read ALL user prompts** in the current session and verify:

- Was each one acknowledged?
- Was each one implemented?
- Was each one verified?

---

## Step 2 — State Snapshot

Output this block before taking any action:

```markdown
### State Snapshot
- **Goal:** [One-line summary of what we're trying to accomplish]
- **Status:** [X% complete / N of M tasks done]
- **Last Completed:** [Most recent checked-off item]
- **Next Action:** [Exact WO + specific sub-task + target file]
- **Blockers:** [Any issues, or "None"]
- **Session Clock:** [How long in this session / estimated remaining]
- **Uncommitted Changes:** [Yes/No — if Yes, commit before new work]
```

---

## Step 3 — Re-evaluation Logic

Apply these rules before executing:

| Situation | Action |
|-----------|--------|
| Fix failing 3+ times | **STOP** — re-diagnose from scratch per Two-Strike Rule. Add logging, prove root cause, propose different approach |
| Strategy in plan is wrong | Update `implementation_plan.md` or work order immediately before continuing |
| User prompt not yet addressed | Address it NOW before moving to next task |
| Uncommitted changes from prior task | **COMMIT first** — never start new work with a dirty tree |
| UI change was made | **Visual verify** — use browser subagent to screenshot before/after |

### Error Memory Check (MANDATORY before debugging)

Before attempting ANY fix, check the error ledger:

```bash
view_file(".agent/skills/error_memory/ERROR_LEDGER.md")  # Search for matching pattern
mcp_mem0_search-memories(query="<error message>", userId="indiiOS-errors")
```

If a match is found, apply the documented fix. If this is a new error, document it after solving.

---

## Step 4 — Execution Loop

1. **Select ONE task** from `task.md` or the active work order
   - Priority: **Blockers > Dependencies > CEO Priority > Document Order**
   - If a task has sub-tasks, complete ALL sub-tasks before marking the parent done
2. **Execute** — write code, update configs, run verification
3. **Verify immediately:**
   - Code change → `npm run typecheck` (must pass before moving on)
   - UI change → browser subagent screenshot
   - Service change → run relevant unit test file
4. **Mark** `[x]` in `task.md` immediately upon completion
5. **Commit cadence:** Commit after each completed WO item (not each line change)
   - Message format: `feat(wo-N): brief description`
   - Example: `feat(wo-1): gate shell modules behind dev flag`
6. **Recurse** — if tasks remain, loop back to Step 2

### Dependency Detection

Before starting a task, check:

- Does this task modify files that another pending task also modifies?
- Does this task depend on another task's output?
- If yes to either → resolve the dependency first or batch them

---

## Step 5 — The Gauntlet (Final Verification)

Only when ALL tasks in `task.md` are `[x]`:

```bash
npm run typecheck   # Must: 0 errors
npm run lint        # Must: 0 errors (warnings acceptable)
npm run build       # Must: successful
npm test -- --run   # Must: all pass
git status          # Must: clean (or intentional changes staged)
```

Also verify:

- No `TODO` or `FIXME` left in modified files
- No `console.log` debug statements left in production code
- All user prompts from this session addressed
- If UI was changed: final browser subagent walkthrough

### Visual Gauntlet (if UI work was done)

```
browser_subagent: Navigate to localhost:4242, visit each modified module,
take screenshots, verify no visual regressions or placeholder text visible
```

---

## Step 6 — Completion Signal

Only after all tasks done AND Gauntlet passed:

> *"✅ All tasks complete. Gauntlet passed. Ready for your next directive, BOSSMAN."*

Include a completion summary:

```markdown
### Completion Summary
- **Tasks completed:** N of M
- **Commits made:** [list of commit hashes + messages]
- **Files modified:** N files across M modules
- **Tests:** All passing (N specs)
- **Build:** Clean (bundle size: X MB)
- **Visual verification:** [Screenshot link if applicable]
```

---

## Session Persistence

If the session is about to end (context getting long, user closing):

1. Update `task.md` with current state — every `[x]`, `[/]`, and `[ ]` must be accurate
2. Commit all work in progress with message: `wip(wo-N): [what was in progress]`
3. Leave a note at the top of `task.md`:

```markdown
<!-- RESUME POINT: WO-N, sub-task Y. Next action: [specific next step]. -->
```

This lets the next session's `/go` invocation pick up exactly where we left off.
