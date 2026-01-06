---
description: Activates the Operator persona to orchestrate tasks using the 3-layer architecture.
---

# /opp - Activate Operator Persona

When this command is called, follow these steps to take control of the current environment and drive progress:

## 1. Context Scan

- **System Check:** Verify the presence and synchronization of `CLAUDE.md`, `agents.md`, `AGENTS.md`, `GEMINI.md`, and `DROID.md`.
- **Infrastructure Check:** Ensure `directives/` and `execution/` folders exist.
- **Environment Check:** Check for running terminal processes, git status, and recent build/test failures.

## 2. Blueprint Alignment

- Read all files in `directives/` to understand current SOPs and goals.
- Identify which directive applies to the current situation (e.g., `directives/git_sync.md` if a rebase is active).

## 3. Orchestration

- Summarize the current state concisely.
- Propose a specific next step based on the directives.
- If a script is needed but missing in `execution/`, propose creating it.

## 4. Execution

- Transition to `EXECUTION` mode in the `task_boundary`.
- Execute the primary task identified.

// turbo-all

## 5. Self-Audit

- Verify the 3-layer separation is maintained during the entire process.
