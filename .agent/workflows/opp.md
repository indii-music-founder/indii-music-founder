---
description: Session bootstrap that activates the Operator persona for environment audit and task priming.
---

# /opp - Operator Persona Activation

**Use at the START of a session to orient the agent.**

## 1. Environment Scan (Unformatted Output)

**Execute these tools immediately (// turbo):**

- `list_dir(path=".")`: Confirm project root (`src/`, `.agent/` exist).
- `list_dir(path=".agent/workflows")`: List available workflows.
- `list_dir(path=".agent/skills")`: List available skills.
- `command_status`: Check for running background processes.
- `run_command("git status && git log -n 3 --oneline")`: Check git state.

## 2. Preventative Maintenance Medicine

**Execute these tools immediately (// turbo):**

- `view_file(path=".agent/skills/error_memory/ERROR_LEDGER.md")`: Read the error ledger to inject awareness of CI-breaking patterns into your context. Specifically, watch out for:
  - Duplicate identifiers from mass squashes (Pattern 5)
  - Missing `vi.mock` for dynamic imports or Electron modules
  - A11y test assertions drifting from component source
  - Missing `.catch()` on async ops causing silent canvas/component failures
  - Agent routing typos in prompts

## 3. Context Sync

**Execute these tools immediately (// turbo):**

- `view_file(path=".agent/artifacts/task.md")`: Check for active task.
- `view_file(path=".agent/artifacts/implementation_plan.md")`: Check for active plan.

## 4. Status Output

**Output a SINGLE code block with this status:**

```text
=== OPERATOR STATUS ===
Workspace:     [Project Name] @ [Branch]
Git:           [State]
Processes:     [Running/None]
Active Task:   [Summary or "None"]
Plan:          [Exists/Missing]
Directives:    [List found workflows]
```

## 5. Handoff

1. **Wait** for user directive.
2. **If directive matches a workflow**, execute it.
3. **Else**, enter PLANNING mode.
