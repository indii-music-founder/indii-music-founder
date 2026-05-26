---
description: Resume and audit workflow. Instructs the agent to continue where it left off, but executes a deep compliance scan first.
---

# /proceed — The Resume & Audit Gate

**Activates the intelligent session-resume and compliance verification loop.**

This command is used whenever the user says "continue", when resuming work after an interruption, or when transitioning tasks. It ensures that before writing *any* new code, the agent understands the exact current state and guarantees that everything built so far is in 100% compliance with codebase constraints.

## 1. Context Synchronization
- **Handoff Sync:** Read the latest checkpoints in `.agent/checkpoints/` and the active `task.md` or `implementation_plan.md`.
- **Change Audit:** Run `git diff` or `git status` to see exactly what was touched in the last session.
- **Mental Map Align:** Read the strategic flowcharts in `docs/flowcharts/` that map the architecture of what is currently being built.

## 2. Hard Compliance Sweep
Perform a rigorous automated scan against our core development constraints:
- **Anti-Laziness Rule:** Verify that there are zero comments containing `// ... rest of code`, placeholder classes, or stub implementations. Every single line of functional code must be present.
- **Model Policy Verification:** Ensure imports map to standard model constants (`AI_MODELS`) and that no banned models are configured or used.
- **Security Check:** Scan local diffs for OpenAI secrets (`sk-`), Google API keys (`AIza`), or Github tokens (`ghp_`). Proactively quarantine them if found.
- **Styling Consistency:** Verify that new styling changes follow Vanilla CSS patterns and do not inject ad-hoc utility frameworks unless explicitly approved.

## 3. Gap Filling Analysis
- **Identify gaps:** Compare the original goals of the prompt or PRD vs what is currently represented in the codebase and task tracking.
- **Determine missing components:** Are there test files missing for new components? Are store slices incomplete? Are Firestore rules out of sync with new collections?

## 4. Intelligent Continuation
- Outline exactly what task you are picking up next.
- Explicitly output the sync state and compliance checklist results:
  ```text
  === PROCEED COMPLIANCE CHECK ===
  [✓] Checkpoint & Handoff Synchronized
  [✓] Anti-Laziness Scan: Passed (0 placeholders)
  [✓] Model & Security Check: Passed
  [✓] Flowchart & Architecture Aligned
  
  RESUMING AT: [Task Name / File Path]
  ```
- Invoke `/middle` or `/go` to resume execution loops.
