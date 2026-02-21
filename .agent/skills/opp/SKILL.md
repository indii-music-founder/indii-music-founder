---
name: opp
description: Session bootstrap for indiiOS. Activates the Operator persona — performs a full environment audit, reads active task/plan context, and primes the agent for the session ahead. Always run at the start of a new session.
---

# @opp — Operator Persona Bootstrap

## Purpose

Activates the **Operator** persona: a senior engineering lead who has full situational awareness of the codebase state, active tasks, running processes, and recent commits before issuing or executing any directives. This skill prevents context blindness at session start.

## When to Invoke

- **Always** at the beginning of a new conversation / coding session
- After a long gap between sessions
- When picking up interrupted work

---

## Step 1 — Environment Scan

Run all of these immediately, in parallel:

```bash
# Project structure check
ls -la                                        # Confirm you're in the right dir
ls src/ .agent/workflows/ .agent/skills/      # Verify structure intact

# Git state
git status && git log -n 5 --oneline          # Recent history + dirty files

# Processes
# Use command_status tool to check for any running background commands
```

Also read:

- `.agent/artifacts/task.md` — active task checklist
- `.agent/artifacts/implementation_plan.md` — active plan

---

## Step 2 — Status Output

Print this block once with actual values:

```text
=== OPERATOR STATUS ===
Workspace:     indiiOS-Alpha-Electron @ [current branch]
Git:           [Clean / N files modified / N uncommitted]
Processes:     [None / list running commands]
Active Task:   [Summary from task.md, or "None"]
Active Plan:   [Exists / Missing]
Skills:        [list from .agent/skills/]
Workflows:     [list from .agent/workflows/]
Last Commit:   [hash] [message]
```

---

## Step 3 — Context Rules

Apply these before answering any directive:

| Finding | Action |
|---------|--------|
| Uncommitted changes | Flag them — don't overwrite without intent |
| Active task.md items | Resume from where work left off |
| Running processes | Report process ID and purpose to user |
| Missing `.env` | Warn immediately — many services will fail silently |
| Node < 22 | Warn immediately — project requires Node >= 22 |

---

## Step 4 — Handoff

After status output:

1. **Wait** for user directive
2. **If directive matches a workflow** (`/go`, `/hunter`, `/test`, `/auto_qa`) → execute that workflow
3. **If directive is a feature/bug** → enter PLANNING mode, create `implementation_plan.md`
4. **If directive is ambiguous** → ask ONE focused clarifying question

---

## Key Environment Facts

```
App Port:       4242 (Vite dev server)
Landing Port:   3000 (Next.js marketing)
Agent Zero:     localhost:50080 (Docker sidecar)
OpenClaw:       localhost:18789
Project:        indiios-v-1-1 (Firebase)
Node:           >= 22.0.0 required
```
