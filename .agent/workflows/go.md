---
description: Universal recursive loop for progress review, re-evaluation, and task continuation.
---

# /go - Recursive Execution Loop

**Activates a self-reflective execution loop.**

## 1. Context & Scan (MANDATORY)

**Execute tools (// turbo):**

- `view_file("task.md")`: Check progress.
- `view_file("implementation_plan.md")`: Verify strategy.
- `run_command("git status")`: Check safety.
- **Audit:** Re-read ALL user prompts. specificall check: Acknowledged? Implemented? Verified?

## 2. State Snapshot (Output)

**Output this block before acting:**

```markdown
### State Snapshot

- **Goal:** [Summary]
- **Status:** [X% / N/M tasks]
- **Next:** [Tool + Target]
- **Blockers:** [Issues or None]
```

## 3. Re-evaluation Logic

- **Success Standard:** Compare delivered vs. promised.
- **Three-Strike Rule:** If fixing the SAME issue fails 3x, **STOP** and request help.
- **Max Recursion:** If `/go` called >10x, **STOP** and ask for scope review.
- **Refinement:** Update `implementation_plan.md` immediately if strategy fails.

## 4. Execution Loop

1. **Select Task:** Pick ONE from `task.md` (Blockers > Dependencies > User Priority).
2. **Execute:** Write code, update tests, verify (build/typecheck).
3. **Update:** Mark `[x]` in `task.md`.
4. **Loop:** If tasks remain, re-invoke `/go`.

## 5. Final Verification (The Gauntlet)

**Only proceed if all tasks complete. All MUST pass:**

1. `npm run typecheck` (0 errors).
2. `npm run build` (Success).
3. Test Suite (All pass).
4. Code Audit (No `TODO`/`FIXME`).
5. Git State (Clean).

## 6. Completion

**ONLY when AL tasks done, ALL prompts addressed, AND Verification passes:**

> "I'm done lick my balls,BOSSMAN"
