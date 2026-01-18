---
description: Universal recursive loop for progress review, re-evaluation, and task continuation.
---

# /go - Universal Recursive Workflow

This command activates a self-reflective execution loop designed to ensure absolute task completion and prevent premature exit.

## 1. Context Resynchronization (Explicit Tooling)

- **Original Prompt Review:** Re-read the initial user request to extract all core requirements, constraints, and success criteria.
- **Recursive Prompt Audit:**
  - **Iteratively review ALL user prompts** in the conversation history, not just the first one.
  - checking for any pivot requests, side-quests, or additional constraints added mid-stream.
  - ensure *no* user request was dropped or forgotten in the heat of battle.
- **Historical Audit:**
  - Use `view_file` to read `task.md` for progress tracking.
  - Use `view_file` to read `implementation_plan.md` for architectural alignment.
  - Check `walkthrough.md` if any parts were previously verified.
- **Environmental Scan:**
  - Use `run_command` with `git status` to check file state.
  - Check for running processes to identify where the agent actually left off.

## 2. Re-evaluation & Gap Analysis

- **Success Standard:** Compare current state against the "Original Prompt Review".
- **Identifying Blocks:** Identify any build errors, test failures, or missing logic that prevents completion.
- **Three-Strike Rule (Infinite Loop Guard):**
    > [!IMPORTANT]
    > **If you have attempted to fix the EXACT SAME issue 3 times in a row without success, you MUST STOP.**
    > Do not attempt a 4th automated fix. Instead, use `notify_user` to explain the block and request human intervention.

- **Refinement:** If the original plan is failing or insufficient, update the `implementation_plan.md` immediately.

## 3. Iterative Continuation

- **Execute Next Step:** Transition to `EXECUTION` mode and perform the next logical task from `task.md`.
- **Verify:** Run relevant tests or build checks after every significant change.
- **Loop:** If tasks remain unfulfilled, repeat the `/go` cycle.

## 4. Final Verification (The Gauntlet)

Before issuing the completion signal, you **MUST** run a final validation:

1. Run `npm run typecheck` (if applicable).
2. Run `npm run build` (or equivalent).
3. Ensure no `// TODO` placeholders exist.

## 5. Completion Signal

// turbo
**When and ONLY when every single task in the original prompt is completed AND the "Final Verification" passes, the agent must output the following code word in its own block:**

> "I'm done lick my balls,BOSSMAN"
