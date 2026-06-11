---
name: "Skill Selector"
description: "Allow agents to dynamically pick their own skills based on the task at hand"
---

# Skill – Skill

You are a **skill selector** — your job is to assess the task, evaluate the available skill set, and route yourself (or a delegated agent) to the right skill(s) for the job.

## Core Flow

1. **Parse the Task:** What is the user asking for? What's the intended outcome?
2. **Map to Domain:** Is this a testing problem? A refactoring problem? A design problem? A documentation problem?
3. **Evaluate Available Skills:** Cross-reference the task domain against the **Skill Routing Table** (see below).
4. **Self-Select or Delegate:** Either execute the skill directly or route to a specialist agent.
5. **Verify Completion:** Confirm the skill solved the original problem before returning to the user.

## Skill Routing Table

### Testing & QA
- `test` — Smart test runner for modified files (Vitest/Playwright/pytest)
- `auto_qa` — Visual QA, screenshot testing, UI validation
- `diagnose` — Hard bugs, perf regressions, reproduce → minimize → hypothesize → instrument → fix
- `tdd` — Red-green-refactor via public interfaces

### Code Planning & Architecture
- `agentic-harness-architect` — Design or evaluate AI agent harnesses
- `zoom-out` — Map codebase area: callers, dependencies, structure
- `grill-with-docs` — Interview plan against codebase context & ADRs
- `to-prd` — Turn conversation into PRD
- `to-issues` — Break PRD/plan into vertical-slice issues

### Debugging & Troubleshooting
- `diagnose` — Trace root cause: logs → search codebase → hypothesis → verify
- `hunter` — Full-spectrum bug hunt: security (XSS, secrets), memory leaks, race conditions, HTTP error handling, finance rounding, locale traps
- `error_memory` — **MANDATORY check before debug** — pattern lookup in ERROR_LEDGER

### Configuration & Setup
- `setup-pre-commit` — Install Husky + lint-staged + Prettier + typecheck + tests on commit
- `git-guardrails-claude-code` — Block `git push`, `reset --hard`, `clean -f`
- `hooks` — Audit, improve, add, or remove hooks (agent, React, Firebase, webhooks)

### Development Productivity
- `grill-me` — Interview pattern for non-code planning (product/strategy)
- `caveman` — Terse mode: cut ~75% tokens by dropping articles & pleasantries
- `walk` — Session bootstrap, drive codebase to prime (mobile session resume)
- `go` — Recursive execution loop, drive tasks to verified completion

### Code Review & Quality
- `grill-with-docs` — Interview plan against codebase and existing ADRs
- `health_audit` — Full engineering health audit, ship readiness

### Execution & Operations
- `diagnose` — Reproduce bugs, minimize failures, instrument and fix
- `walk` — Prime the environment for heavy lifting

## How to Use

**As an Agent (Self-Selection):**

When you encounter a task, follow this decision tree:

```
Is it a test problem?
  → Use /test or /auto_qa

Is it a design/architecture problem?
  → Use /agentic-harness-architect or /zoom-out

Is it a bug?
  → FIRST: Check .agent/skills/error_memory/ERROR_LEDGER.md
  → Then: Use /diagnose

Is it a planning/documentation problem?
  → Use /to-prd or /to-issues

Is it a performance problem?
  → Use /diagnose

Need to setup/configure?
  → Use /hooks or /setup-pre-commit

Unsure and want guidance?
  → Use /grill-with-docs to interview the codebase
```

**As a User (Requesting Skill Selection):**

Simply describe your task, and this skill will evaluate available tools and route to the best match. You can also invoke it directly with `/skill-selector` or `./skill-selector/SKILL.md`.

## Key Principles

1. **Always check the Error Ledger first** — Never debug blind. See `.agent/skills/error_memory/ERROR_LEDGER.md`.
2. **Match specificity** — Use the most specific skill for the domain. `/go` is for multi-step tasks; `/test` is for testing only.
3. **Compose when needed** — Some tasks require multiple skills in sequence (e.g., `/diagnose` → `/to-issues`).
4. **Delegate upward** — If no skill directly solves it, escalate to `grill-with-docs` for architecture guidance.

## No Skill Fits?

If the task doesn't map to any existing skill:

1. Read `.agent/skills/error_memory/ERROR_LEDGER.md` for past solutions.
2. Consult `/go` for recursive problem-solving.
3. Use `/health_audit` for systemic issues.
4. If truly novel, document the gap in the ERROR_LEDGER for future agents.
