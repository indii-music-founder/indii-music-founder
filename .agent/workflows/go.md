---
description: Universal recursive loop for progress review, re-evaluation, and task continuation.
---

# /go - Universal Recursive Workflow

This command activates a self-reflective execution loop designed to ensure absolute task completion and prevent premature exit.

---

## 🔄 Phase 1: Context Resynchronization (MANDATORY TOOLING)

---

**The agent MUST execute the following tools in order. No shortcuts allowed.**

### 1.1 Artifact Audit

- **MUST** use `view_file` on `task.md` → Extract checklist state and completion percentage.
- **MUST** use `view_file` on `implementation_plan.md` → Verify architectural alignment and strategy.
- **OPTIONAL** use `view_file` on `walkthrough.md` if verification steps were previously documented.

### 1.2 Environmental Scan

- **MUST** use `run_command` with `git status` → Check for uncommitted changes, merge conflicts, or working tree state.
- **RECOMMENDED** check for running processes or zombie terminals that indicate the agent's last action.

### 1.3 Original Prompt Review

- **Re-read the FIRST user request** in the conversation to extract all core requirements, constraints, and success criteria.
- Extract the explicit goal, implicit expectations, and any "done when" conditions.

### 1.4 Recursive Prompt Audit

**Iteratively review ALL user prompts** in the conversation history, not just the first one.

For EACH user request encountered, verify:

- [ ] Was the request acknowledged?
- [ ] Was code written/modified to address it?
- [ ] Was verification performed (tests, build, manual check)?

**If any checkbox is unchecked, that request is INCOMPLETE and must be addressed.**

This prevents the classic pivot-loss bug where mid-conversation requests are forgotten.

---

## 📸 Phase 1.5: State Snapshot (Output to User)

---

Before proceeding with any execution, the agent MUST output a status report:

```
### Current State Snapshot
- **Original Goal:** [1-sentence summary of the initial task]
- **Current Status:** [X% complete] | [N/M tasks done]
- **Next Action:** [Specific tool call + target file/command]
- **Known Blockers:** [List any errors, failures, or dependencies] or "None"
```

This forces articulation of understanding before action.

---

## 🧪 Phase 2: Re-evaluation & Gap Analysis

---

### 2.1 Success Standard

Compare current state (from Phase 1.5) against the "Original Prompt Review".

- What was promised vs. what was delivered?
- Are there any implicit requirements that haven't been addressed?

### 2.2 Identifying Blocks

Identify any build errors, test failures, type errors, or missing logic that prevents completion.

- Use `npm run typecheck` to surface type issues.
- Use test results from `task.md` or run relevant test suites.
- Check for `// TODO`, `// FIXME`, or `PLACEHOLDER` comments in code.

### 2.3 Three-Strike Rule (Infinite Loop Guard)

> [!IMPORTANT]
> **If you have attempted to fix the EXACT SAME issue 3 times in a row without success, you MUST STOP.**
>
> Do not attempt a 4th automated fix. Instead:
>
> 1. Document the failure in `implementation_plan.md` under a "Blockers" section.
> 2. Output a detailed explanation to the user with:
>    - What was attempted (all 3 approaches)
>    - Why each approach failed
>    - What additional context or permissions are needed
> 3. Request human intervention explicitly.

### 2.4 Max Iterations Safety (Runaway Prevention)

Track the number of `/go` invocations in the current conversation.

**If `/go` has been called more than 10 times:**

- STOP immediately.
- Output: "⚠️ Maximum recursion depth reached (10 iterations). Possible architectural issue or scope creep detected."
- Request user guidance on whether to:
  - Simplify the original goal
  - Break it into sub-tasks
  - Pivot the approach entirely

### 2.5 Refinement

If the original plan in `implementation_plan.md` is failing or insufficient:

- **Immediately update** `implementation_plan.md` with the new strategy.
- Document why the pivot was necessary.
- Get user confirmation if the pivot significantly changes the original goal.

---

## ⚡ Phase 3: Iterative Continuation

---

### 3.1 Task Selection

- **Pick ONE uncompleted task** from `task.md`.
- If multiple tasks are available, prioritize by:
  1. **Blockers first** (fixes that unblock other work)
  2. **Dependencies** (tasks that other tasks depend on)
  3. **User priority** (if explicitly stated in conversation)

### 3.2 Execution

- **Execute the task completely:**
  - Write or modify code
  - Write or update tests
  - Run verification (typecheck, build, test suite)
- **No half-measures.** Do not mark a task as "done" until verification passes.

### 3.3 State Update

- **Mark the task done** in `task.md` using `replace_file_content`.
- Update the checkbox: `- [ ]` → `- [x]`.
- Add a timestamp or commit reference if applicable.

### 3.4 Blocker Handling

- **If blockers emerge during execution:**
  - Update `implementation_plan.md` with the blocker description.
  - Propose a pivot strategy or workaround.
  - Apply the Three-Strike Rule if this is a recurring blocker.

### 3.5 Loop Condition

- **If tasks remain in `task.md`:** Re-invoke `/go` to continue the loop.
- **If all tasks are complete:** Proceed to Phase 4 (Final Verification).

---

## ✅ Phase 4: Final Verification (The Gauntlet)

---

Before issuing the completion signal, you **MUST** run a final validation sequence.

**All commands below MUST pass. If any fail, return to Phase 3.**

// turbo

1. **Type Safety:** Run `npm run typecheck` (if applicable to the project).
   - **Pass Criteria:** Zero type errors.
   - **On Failure:** Fix type errors and re-run.

// turbo
2. **Build Integrity:** Run `npm run build` (or equivalent production build).

- **Pass Criteria:** Build completes without errors.
- **On Failure:** Fix build errors and re-run.

// turbo
3. **Test Coverage:** Run relevant test suites (unit, integration, or E2E as appropriate).

- **Pass Criteria:** All tests pass. No skipped tests unless explicitly approved.
- **On Failure:** Fix failing tests and re-run.

1. **Code Quality Audit:**
   - Search codebase for `// TODO`, `// FIXME`, `PLACEHOLDER`, or `HACK` comments.
   - **Pass Criteria:** Zero unresolved placeholders (or documented as intentional with issue tracker links).
   - **On Failure:** Resolve placeholders or document why they must remain.

2. **Git Cleanliness:**
   - Run `git status` to ensure no uncommitted changes (unless explicitly part of the deliverable).
   - **Pass Criteria:** Working tree clean OR user-approved exception.

---

## 🎯 Phase 5: Completion Signal

---

**When and ONLY when:**

- Every single task in the original prompt is completed, AND
- Every user request in the conversation has been addressed, AND
- The "Final Verification" (Phase 4) passes completely,

**The agent MUST output the following code phrase in its own block:**

> "I'm done lick my balls,BOSSMAN"

**This phrase signals absolute task completion. Do not output it prematurely.**

---

## 🔧 Meta-Rules for `/go` Execution

1. **No Partial Cycles:** You cannot skip phases. Execute 1 → 1.5 → 2 → 3 → 4 → 5 in order.
2. **Tool Invocations are Non-Negotiable:** If a phase says "MUST use `view_file`", you cannot summarize from memory.
3. **User Visibility:** Always output the State Snapshot (Phase 1.5) so the user knows what you're doing.
4. **Iteration Tracking:** Mentally (or explicitly in notes) track how many `/go` cycles have occurred. Honor the 10-iteration limit.
5. **Completion Discipline:** Do not rationalize premature completion. The completion signal is sacred.

---

**End of Workflow Definition**
