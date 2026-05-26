---
description: Finalization and verification workflow. Generates closing notes, updates architecture diagrams, and runs /ci-validate for a clean repository state.
---

# /end — The Closing Protocol

**Activates the intelligent wrap-up, documentation, and verification sequence.**

This command is run when the feature or task is deemed complete. It ensures everything is documented, cleanly tested, and the repository is pristine before ending the session.

## 1. Smart Finalization
- Review the initial user prompt and compare it against the completed work in `task.md`.
- Verify that *everything* promised has been delivered.
- Ensure there are no leftover `TODO` or `FIXME` comments related to this session's work.

## 2. Standardized Closing Process
Execute the formal note-taking and checkpointing process:
- **Documentation:** Generate a summary of the session's learnings, key decisions made, and bugs fixed. Update `.agent/skills/error_memory/ERROR_LEDGER.md` with any new patterns discovered.
- **Checkpoints:** Update the agent's distributed checkpoint in `.agent/checkpoints/` with the final state of the work so the next session can pick up cleanly.

## 3. Final Architecture Update (via `/flowchart`)
If any architecture, state flow, or logic shifted during the execution phase:
- Invoke the **`/flowchart`** command for a final pass to update or generate the definitive diagrams for what was built.
- **Save Requirement:** Update the relevant markdown files inside `docs/flowcharts/` as part of the formal closing notes.

## 4. The Gauntlet (via `/ci-validate`)
Signal "we're done" and leave a perfectly clean repository:
- Invoke the **`/ci-validate`** command.
- This will run the auto-fix phase, the hunter bug scan, commit consolidation, and all testing shards.
- **Do not exit this phase until the CI script passes flawlessly.**
