---
name: go
description: Universal recursive execution loop for indiiOS. Reviews progress, re-evaluates strategy, and drives task completion to verified, shipping state. Invoke as /go or @go.md at any point during a session.
---

# @go — Recursive Execution Loop

## Purpose

A self-reflective execution engine that prevents getting stuck, ensures all user prompts are acknowledged, and drives tasks from start to verified completion. Use this when you want the agent to keep moving autonomously without stopping for approval.

## When to Invoke

- After an `implementation_plan.md` is approved and you want hands-free execution
- When you sense the agent has lost track of the broader goal
- When multiple tasks are in flight and you want a checkpoint
- At the start of a new session to resume prior context

---

## Step 1 — Context & Scan (MANDATORY, always run first)

```bash
# Always run these immediately
view_file("task.md")                    # Check which tasks are [x] done / [/] in progress / [ ] pending
view_file("implementation_plan.md")     # Verify current strategy is still valid
git status && git log -n 3 --oneline   # Confirm clean working state
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
- **Next Action:** [Exact tool + target for next step]
- **Blockers:** [Any issues, or "None"]
```

---

## Step 3 — Re-evaluation Logic

Apply these rules before executing:

| Situation | Action |
|-----------|--------|
| Fix failing 3+ times | **STOP** — re-diagnose from scratch, propose different approach |
| `/go` invoked > 10 times | **STOP** — ask user for scope review |
| Strategy in plan is wrong | Update `implementation_plan.md` immediately before continuing |
| User prompt not yet addressed | Address it NOW before moving to next task |

---

## Step 4 — Execution Loop

1. **Select ONE task** from `task.md` — priority: Blockers > Dependencies > User Priority > Order
2. **Execute** — write code, update configs, run verification commands
3. **Mark** `[x]` in `task.md` immediately upon completion
4. **Recurse** — if tasks remain, invoke `/go` again

---

## Step 5 — The Gauntlet (Final Verification)

Only when ALL tasks in `task.md` are `[x]`:

```bash
npm run typecheck   # Must: 0 errors
npm run build       # Must: successful
npm test -- --run   # Must: all pass
git status          # Must: clean (or intentional changes staged)
```

Also verify:

- No `TODO` or `FIXME` left in modified files
- No `console.log` debug statements left in production code
- All user prompts from this session addressed

---

## Step 6 — Completion Signal

Only after all tasks done AND Gauntlet passed:

> *"✅ All tasks complete. Gauntlet passed. Ready for your next directive, BOSSMAN."*
