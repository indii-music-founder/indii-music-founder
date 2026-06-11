---
description: Mid-session execution and review loop. Leverages the /go command to recursively execute tasks and /flowchart to map technical logic changes as they happen.
---

# /middle — The Execution Engine

**Activates the intelligent execution and task iteration sequence.**

This command is used during the core build phase to manage iterative execution, handle blockers, and map complex state logic dynamically.

## 1. Smart Execution Analysis
- Analyze the active task ledger and implementation plan to understand where execution currently stands. Prefer the current user objective/thread goal first, then `.agent/artifacts/task.md` and `.agent/artifacts/implementation_plan.md`, and use root `task.md` / `implementation_plan.md` only if they clearly match the current goal.
- **Stale Ledger Guard:** If a task or plan file describes unrelated old work, do not treat it as authoritative. State the mismatch and proceed from current user intent plus current worktree evidence.
- Dynamically decide which tools, sub-agents, or commands are needed for the current iteration.
- **Context Drift:** If the conversation has drifted or feels misaligned, invoke **`/review`** to pause, summarize progress, and explicitly realign with the user.
- **Cross-Boundary Contract Verification:** When connecting two systems (e.g., Renderer writing to Firestore, and Cloud Function reading from Firestore), you MUST manually verify that the write-schema and read-schema are completely identical in casing and type. Do not rely on isolated unit tests; verify the shared contract.
- **Strict Issue Validation:** Do not mark issues fixed based only on broad validation. For each issue, list explicit acceptance criteria and show evidence for each one. If any criterion is not proven, mark the issue PARTIAL or OPEN. For dependency work, npm audit and npm ls must both be clean for the dependencies being claimed fixed. For release/download work, local artifacts are not enough; prove upload path and Founder download authorization. Do not add placeholder records to permanent covenant/source-of-truth files.
- **Proof of Verification:** You are forbidden from stating "it works" or "I have verified this" without pasting the raw terminal output, test results, or explicit browser DOM state that proves it. If you cannot provide the raw output, the task is incomplete.
- **Zero-Placeholder Policy:** When editing files, you must NEVER use placeholders like `// rest of code` or `// existing implementations here`. You must output the full, functional code every time. If you realize you skipped something to save time, stop and rewrite it completely.
- **Anti-Looping (Two-Strike Rule):** If your proposed fix fails verification twice in a row, you must STOP. Do not attempt a third minor tweak. You must write a summary of why the current approach is fundamentally flawed and propose a completely new architectural approach before proceeding.

## 2. Recursive Execution Loop (via `/go`)
Invoke the **Recursive Execution Loop**:
- Read and execute the `/go` command instructions.
- Work through the tasks one by one, verifying locally after each change.
- Run **`/get-git`** periodically to ensure local commits are validated and pushed, and remote changes are integrated.
- Unstick blockers using the Error Ledger as defined in `/go`.

## 3. Dynamic Technical Diagramming (via `/flowchart`)
As complex logic, state transitions, or component architectures are built:
- Invoke the **`/flowchart`** command to generate micro/technical diagrams (e.g., Zustand state flows, Component renders, Firestore queries).
- **Save Requirement:** The generated flowchart MUST be saved as a markdown file inside `docs/flowcharts/` (e.g., `docs/flowcharts/feature-name-micro.md`) with a detailed transition breakdown.

**Repeat the `/middle` process until all tasks in the active task ledger are marked complete, or until the current user objective is verified complete when no matching ledger exists.**


## Elevate and Polish (The `/better` Audit)
At the conclusion of this workflow, automatically execute the `/better` workflow to:
1. Audit the changes and additions from every angle (Performance, DevEx, Architecture).
2. Elevate the codebase to Platinum Quality Standards.
3. Apply any necessary micro-refactors or polish before proceeding.
