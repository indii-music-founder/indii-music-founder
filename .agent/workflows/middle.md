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
- **Proof of Verification:** You are forbidden from stating "it works" or "I have verified this" without pasting the raw terminal output, test results, or explicit browser DOM state that proves it. If you cannot provide the raw output, the task is incomplete. **For UI or browser-based features, you MUST use the `chrome-devtools` MCP plugin to interactively test the browser session, capture screenshots or DOM snapshots, and prove it works before marking the task complete.**
- **Test-Impact Verification (the pre-commit gap):** The pre-commit hook runs ONLY lint + typecheck + security scan — it does NOT run the unit suite. A rename, an enum/union edit, or a change to any shared literal (agent ids, domain strings, status enums) can pass lint+typecheck and STILL break test assertions or downstream call sites. Therefore: when a change renames or re-values any symbol that other code/tests reference by string or literal, you MUST run the affected `npm test -- --run <files>` (or the full suite if the blast radius is unclear) and paste the passing output BEFORE committing. "Typecheck passed" is not proof the tests pass. Where a class of literal is easy to mis-enter (e.g. agent ids vs `VALID_AGENT_IDS`), prefer a static guard test that scans all source so the whole class is caught at once, not one site at a time.
- **Zero-Placeholder Policy:** When editing files, you must NEVER use placeholders like `// rest of code` or `// existing implementations here`. You must output the full, functional code every time. If you realize you skipped something to save time, stop and rewrite it completely.
- **The Ponytail Protocol:** When writing or editing code, strictly adhere to the Ponytail principles (YAGNI, stdlib, native features, dependencies, one-liners) to ensure code footprint is minimal but robust.
- **Anti-Looping (Strike Ladder):** This is the same ladder used by `/go`, `/issue`, and `/better` — apply it identically everywhere. **Strike 2 (Pivot):** if your proposed fix fails verification twice in a row, STOP. Do not attempt a third minor tweak. Write a summary of why the current approach is fundamentally flawed and propose a completely new architectural approach. **Strike 3 (Escalate):** if the new approach also fails, stop work on that task and ask the user for help with a detailed blocker description.

## 2. Recursive Execution Loop (via `/go`)
Invoke the **Recursive Execution Loop**:
- Read and execute the `/go` command instructions.
- Work through the tasks one by one, verifying locally after each change.
- Run **`/get-git`** periodically to ensure local commits are validated and pushed, and remote changes are integrated.
- Unstick blockers using the Error Ledger as defined in `/go`.

## 2.5 Pattern Health Checkpoint (via `/health`)
Mid-session pattern monitoring to catch emerging issues:
- Run pattern detector: `npm run detect:bugs`
- **Compare to baseline:** Did patterns increase while coding?
  - ✅ Same or improved: Continue work
  - ⚠️ Increased slightly (1-10 points): Document, monitor closely
  - ❌ Increased significantly (10+ points): Stop and fix new patterns first
- **Action if patterns increased:**
  - Identify what patterns you added (unprotected awaits, Base64 payloads, etc.)
  - Add try-catch, error handling, or validation tests
  - Re-run detector to verify improvement
  - Resume original task
- This is **optional but recommended** at natural breakpoints (after completing a module, finishing a feature component, etc.)

## 3. Dynamic Technical Diagramming (via `/flowchart`)
As complex logic, state transitions, or component architectures are built:
- Invoke the **`/flowchart`** command to generate micro/technical diagrams (e.g., Zustand state flows, Component renders, Firestore queries).
- **Save Requirement:** The generated flowchart MUST be saved as a markdown file inside `docs/flowcharts/` (e.g., `docs/flowcharts/feature-name-micro.md`) with a detailed transition breakdown. Refer to the existing high-level maps like [01-grand-unified-macro.md](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/docs/flowcharts/01-grand-unified-macro.md), [backend-only-api-boundary.md](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/docs/flowcharts/backend-only-api-boundary.md), and [entire-app-architecture.md](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/docs/flowcharts/entire-app-architecture.md) to ensure consistent node naming, HSL-neon styling classDef definitions, and architectural alignment.

**Repeat the `/middle` process until all tasks in the active task ledger are marked complete, or until the current user objective is verified complete when no matching ledger exists.**

> **Note on polish:** Do NOT run a separate `/better` pass at the end of `/middle`. The `/go` loop already runs `/better` on each task's modified files (Step 5), and `/end` runs the final session-wide pass. Triple-polishing the same files burns time and tokens without adding quality.
