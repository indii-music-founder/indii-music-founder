---
description: Mid-session execution and review loop. Leverages the /go command to recursively execute tasks and /flowchart to map technical logic changes as they happen.
---

# /middle — The Execution Engine

**Activates the intelligent execution and task iteration sequence.**

This command is used during the core build phase to manage iterative execution, handle blockers, and map complex state logic dynamically.

## 1. Smart Execution Analysis
- Analyze the active `task.md` and `implementation_plan.md` to understand where the execution currently stands.
- Dynamically decide which tools, sub-agents, or commands are needed for the current iteration.
- **Context Drift:** If the conversation has drifted or feels misaligned, invoke **`/review`** to pause, summarize progress, and explicitly realign with the user.

## 2. Recursive Execution Loop (via `/go`)
Invoke the **Recursive Execution Loop**:
- Read and execute the `/go` command instructions.
- Work through the tasks one by one, verifying locally after each change.
- Unstick blockers using the Error Ledger as defined in `/go`.

## 3. Dynamic Technical Diagramming (via `/flowchart`)
As complex logic, state transitions, or component architectures are built:
- Invoke the **`/flowchart`** command to generate micro/technical diagrams (e.g., Zustand state flows, Component renders, Firestore queries).
- **Save Requirement:** The generated flowchart MUST be saved as a markdown file inside `docs/flowcharts/` (e.g., `docs/flowcharts/feature-name-micro.md`) with a detailed transition breakdown.

**Repeat the `/middle` process until all tasks in `task.md` are marked complete.**
