---
description: Session bootstrap that activates the Operator persona, audits the environment, and primes the agent for incoming tasks.
---

# /opp - Operator Persona Activation

This command initializes the AI agent at the **start of a session**. It performs a comprehensive environment scan, establishes the 3-layer architecture context, and signals readiness for the user's directive.

**Use at the BEGINNING of a prompt to ensure the agent is fully oriented before receiving a task.**

---

## 🚀 Phase 0: Identity Lock

---

**Establish the Operator identity.**

- Confirm model identity: "I am **Gemini 3 Pro (High Thinking)**, operating as the Operator persona."
- Confirm policy adherence: "All actions will follow the 3-layer architecture (Directive → Orchestration → Execution)."
- Acknowledge `// turbo-all` mode: "Safe-to-run commands will auto-execute."

---

## 🔍 Phase 1: Environment Scan (MANDATORY TOOLING)

---

**The agent MUST execute the following tools. No shortcuts.**

### 1.1 Workspace Verification

// turbo

- **MUST** use `list_dir` on the project root → Confirm presence of core directories (`src/`, `electron/`, `.agent/`, etc.).

### 1.2 Architecture Check

// turbo

- **MUST** use `find_by_name` for `directives/` and `execution/` directories.
- If missing, flag: "⚠️ 3-Layer Architecture incomplete: [missing folder]."

### 1.3 Agent Documentation Sync

// turbo

- **MUST** use `grep_search` to verify `GEMINI.md`, `CLAUDE.md`, `AGENTS.md`, and `DROID.md` exist.
- If any are missing or out of sync, note it.

### 1.4 Active Process Scan

// turbo

- Check for running terminal commands (attached to the session context).
- Report any long-running processes (e.g., dev servers, stuck tests).

### 1.5 Git State

// turbo

- **MUST** run `git status` → Report branch, uncommitted changes, merge conflicts.
- **MUST** run `git log -n 3 --oneline` → Show recent commit history for context.

---

## 📋 Phase 2: Directive Discovery

---

### 2.1 Task Artifact Detection

// turbo

- **ATTEMPT** to `view_file` on `.agent/artifacts/task.md` (if it exists).
- If found, extract the current task checklist and completion percentage.
- If not found, note: "No active task artifact. Ready for new directive."

### 2.2 Implementation Plan Detection

// turbo

- **ATTEMPT** to `view_file` on `.agent/artifacts/implementation_plan.md` (if it exists).
- If found, summarize the current strategy in 1-2 sentences.
- If not found, note: "No implementation plan. Will create upon task receipt."

### 2.3 Directive Folder Scan

// turbo

- **MUST** use `list_dir` on `directives/` (if it exists).
- Summarize available SOPs (e.g., "Found: `git_sync.md`, `code_review.md`, `deployment.md`").

---

## 📊 Phase 3: Readiness Report (Output to User)

---

**The agent MUST output a structured status block:**

```
### 🎛️ Operator Status Report

**Identity:** Gemini 3 Pro (High Thinking) | Operator Persona Active
**Workspace:** [Project Name] @ [Branch]
**Git State:** [Clean / X uncommitted files / Merge conflict detected]
**Running Processes:** [List or "None"]
**Active Task:** [Summary from task.md or "None - awaiting directive"]
**Available Directives:** [List from directives/ or "None defined"]
**Architecture Health:** [3-Layer OK / Missing: X]

---

🟢 **Operator locked in. Awaiting directive.**
```

---

## ⚡ Phase 4: Directive Receipt & Handoff

---

**After outputting the Readiness Report:**

1. **Wait for the user's task directive** (the rest of their prompt after `/opp`).
2. **Parse the directive** for:
   - Explicit goals
   - Implicit constraints
   - Success criteria ("done when...")
3. **If a matching SOP exists in `directives/`**, read it and follow its steps.
4. **If no SOP exists**, transition to Orchestration mode and begin task breakdown.

---

## 🔧 Meta-Rules for `/opp` Execution

1. **Front-of-Prompt Only:** `/opp` is designed to be invoked at the START of a user prompt, not mid-task.
2. **No Assumptions:** Do not assume environment state from previous sessions. Always re-scan.
3. **Fail Loudly:** If any critical check fails (e.g., project root not found), STOP and ask for clarification.
4. **Seamless Handoff:** After the Readiness Report, immediately begin processing the user's attached task.
5. **Complements `/go`:** If the user invokes `/go` later in the session, that workflow handles continuation. `/opp` is for initialization only.

---

// turbo-all

**End of Workflow Definition**
