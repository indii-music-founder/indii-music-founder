---
description: Initialization workflow. Sets up the context, performs environment scans via /opp, and maps the strategy visually with /flowchart. Run this to start a feature or conversation.
---

# /start — The Genesis Workflow

**Activates the intelligent start-of-session and feature initialization sequence.**

This command must be run at the beginning of any new feature, prompt, or session. It sets up the context, audits the environment, and maps the architecture.

## 1. Smart Context Assessment
Before taking any action, analyze the current workspace:
- Check `git branch` and `git status`. Are we on a clean slate?
- Review any open files or recently modified files.
- **Clarification Gate:** If the user's prompt is underspecified, ASK clarifying questions right now to determine *exactly what* needs to be built.
- **Alignment:** If the task requires deep specialization, invoke **`/review`** to explicitly align on persona and constraints before proceeding.
- **Definition of Done (DoD) Contract:** Explicitly classify the work at the start of the session: Is this a **Scaffold Phase** (mocks, types, structural stubs allowed) or a **Runtime Phase** (end-to-end execution and wiring required)? You CANNOT claim a feature is "Production Ready" unless it is fully wired in a Runtime Phase.
- **Strict Issue Validation:** Do not mark issues fixed based only on broad validation. For each issue, list explicit acceptance criteria and show evidence for each one. If any criterion is not proven, mark the issue PARTIAL or OPEN. For dependency work, npm audit and npm ls must both be clean for the dependencies being claimed fixed. For release/download work, local artifacts are not enough; prove upload path and Founder download authorization. Do not add placeholder records to permanent covenant/source-of-truth files.

## 2. Environment Bootstrap (via `/opp`)
Invoke the **Operator Persona Activation**:
- Read and execute the `/opp` command instructions exactly.
- This checks handoff state, memory, node modules, and error ledgers.

## 3. High-Level Architecture Diagram (via `/flowchart`)
Before writing any code, map the strategy:
- Invoke the **`/flowchart`** command to generate a macro-level Mermaid diagram of the new feature or sequence.
- **Save Requirement:** The generated flowchart MUST be saved as a markdown file inside `docs/flowcharts/` (e.g., `docs/flowcharts/feature-name-macro.md`) with a detailed explanation underneath the diagram.

## 4. Sub-Command Routing
Determine if any additional workflows are needed for this specific feature:
- If Test-Driven Development is requested, queue up `/tdd`.
- If the plan needs to be broken into Github issues, queue up `/to-issues`.

**When complete, output a summary of the initialized state and proceed to the first task or request user confirmation to begin execution.**
