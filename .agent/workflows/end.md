---
description: Finalization and verification workflow. Generates closing notes, updates architecture diagrams, and runs /ci-validate for a clean repository state.
---

# /end — The Closing Protocol

**Activates the intelligent wrap-up, documentation, and verification sequence.**

This command is run when the feature or task is deemed complete. It ensures everything is documented, cleanly tested, and the repository is pristine before ending the session.

## 1. Smart Finalization
- Review the initial user prompt and compare it against the completed work in the active task ledger. Prefer the current user objective/thread goal first, then `.agent/artifacts/task.md`, and use root `task.md` only if it clearly matches the current goal.
- **Stale Ledger Guard:** If a task file describes unrelated old work, do not use it as completion evidence. State that it is stale and verify against current user intent plus current worktree evidence.
- Verify that *everything* promised has been delivered.
- Ensure there are no leftover `TODO` or `FIXME` comments related to this session's work.
- **Strict Issue Validation:** Do not mark issues fixed based only on broad validation. For each issue, list explicit acceptance criteria and show evidence for each one. If any criterion is not proven, mark the issue PARTIAL or OPEN. For dependency work, npm audit and npm ls must both be clean for the dependencies being claimed fixed. For release/download work, local artifacts are not enough; prove upload path and Founder download authorization. Do not add placeholder records to permanent covenant/source-of-truth files.
- **Proof of Verification:** You are forbidden from stating "it works" or "I have verified this" without pasting the raw terminal output, test results, or explicit browser DOM state that proves it. If you cannot provide the raw output, the task is incomplete.

## 2. Standardized Closing Process
Execute the formal note-taking and checkpointing process:
- **Documentation:** Generate a summary of the session's learnings, key decisions made, and bugs fixed. Update `.agent/skills/error_memory/ERROR_LEDGER.md` with any new patterns discovered.
- **Checkpoints:** Update the agent's distributed checkpoint in `.agent/checkpoints/` with the final state of the work so the next session can pick up cleanly.
- **Session Checkpoint Script:** Always execute `bash .claude/scripts/checkpoint.sh` before ending the session to commit the final state and ensure the next session picks up cleanly.

## 3. Final Architecture Update (via `/flowchart`)
If any architecture, state flow, or logic shifted during the execution phase:
- Invoke the **`/flowchart`** command for a final pass to update or generate the definitive diagrams for what was built.
- **Save Requirement:** Update the relevant markdown files inside `docs/flowcharts/` as part of the formal closing notes.

## 4. Resource Cleanup & The Gauntlet (via `/ci-validate`)
Signal "we're done" and leave a perfectly clean repository and environment:
- **Resource Cleanup (MANDATORY):** Before finalizing the session, list all background tasks and subagents. You MUST explicitly terminate any running background tasks (using `manage_task` with action `kill`) and all active subagents (using `manage_subagents` with action `kill_all`) to prevent leaking processes or orphaned CPU/memory resource usage.
- **Uncommitted Workspace Changes Alert (MANDATORY):** You must run a `git status` check at the start of `/end`. If any dirty or untracked files remain in the workspace, you MUST list them prominently in your final session report under a dedicated `### ⚠️ Uncommitted Workspace Changes / Pre-existing Dirty Files` header, explaining which session they belong to and prompting the user for instructions.
- **Clean Repository Definition:** In a multi-agent environment, define "clean repository" as either "fully clean" or "clean for this objective." If there are unrelated dirty files in the worktree, you MUST explicitly list them for the user or intentionally stash/commit them before proceeding.
- **Anti-Hallucination Audit:** Before running the final CI sequence, you MUST run a `grep` scan for `MOCK`, `TODO`, and `stub` across all files you touched during this session. If any mocks or stubs exist in the critical path, you are expressly forbidden from stating the feature is "fully implemented". You must state: "Scaffolding Complete. Mocks remain."
- Invoke the **`/ci-validate`** command.
- This will run the auto-fix phase, the hunter bug scan, commit consolidation, and all testing shards.
- **Do not exit this phase until the CI script passes flawlessly.**
- **Push Commits to GitHub (MANDATORY):** Once all CI validation checks pass flawlessly, you MUST run `git push origin $(git branch --show-current)` to ensure all local commits are pushed to GitHub, synchronizing the work and triggering the remote deployment pipeline.


## Elevate and Polish (The `/better` Audit)
At the conclusion of this workflow, automatically execute the `/better` workflow to:
1. Audit the changes and additions from every angle (Performance, DevEx, Architecture).
2. Elevate the codebase to Platinum Quality Standards.
3. Apply any necessary micro-refactors or polish before proceeding.
