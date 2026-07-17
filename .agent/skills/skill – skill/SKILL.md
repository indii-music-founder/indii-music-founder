---
name: "Skill Selector"
description: "Allow agents to dynamically pick their own skills based on the task at hand"
---

# Skill – Skill

You are a **skill selector** — your job is to assess the task, evaluate the available skill set, and route yourself (or a delegated agent) to the right skill(s) for the job.

## Core Flow

1. **Parse the Task:** What is the user asking for? What's the intended outcome?
2. **Map to Domain:** Is this a testing problem? A refactoring problem? A design problem? A documentation problem? A creative production problem?
3. **Evaluate Available Skills:** Cross-reference the task domain against the **Skill Routing Table** (see below).
4. **Self-Select or Delegate:** Either execute the skill directly or route to a specialist agent.
5. **Verify Completion:** Confirm the skill solved the original problem before returning to the user.

## Skill Routing Table

### Testing & QA
- `test` — Smart test runner for modified files (Vitest/Playwright/pytest)
- `auto_qa` — Visual QA, screenshot testing, UI validation
- `tdd` — Red-green-refactor via public interfaces
- `health-check` — Preventative health audit, detects hidden bug patterns before production

### Debugging & Troubleshooting
- `diagnose` — Trace root cause: logs → search codebase → hypothesis → instrument → verify → fix
- `hunter` — Full-spectrum bug hunt: security (XSS, secrets), memory leaks, race conditions, HTTP error handling, finance rounding, locale traps
- `error_memory` — **MANDATORY check before debug** — pattern lookup in ERROR_LEDGER.md

### Code Planning & Architecture
- `agentic-harness-architect` — Design or evaluate AI agent harnesses (12 production-grade primitives)
- `zoom-out` — Map codebase area: callers, dependencies, structure
- `grill-with-docs` — Interview plan against codebase context & ADRs
- `to-prd` — Turn conversation into PRD
- `to-issues` — Break PRD/plan into vertical-slice issues

### Development Productivity
- `grill-me` — Interview pattern for non-code planning (product/strategy)
- `caveman` — Terse mode: cut ~75% tokens by dropping articles & pleasantries
- `walk` — Session bootstrap, drive codebase to prime (mobile session resume)
- `go` — Recursive execution loop, drive tasks to verified completion

### Code Review & Quality
- `health_audit` — Full engineering health audit, ship readiness
- `hooks` — Audit, improve, add, or remove hooks (agent, React, Firebase, webhooks)

### Configuration & Setup
- `setup-pre-commit` — Install Husky + lint-staged + Prettier + typecheck + tests on commit
- `git-guardrails-claude-code` — Block `git push`, `reset --hard`, `clean -f`

### Creative & Media Production
- `indii-cinema-worldbuilder` — Cinematic worldbuilding for music video and visual album projects
- `indii-director` — AI director for cinematic sequences and narrative structure

---

### Vendored Skills (`.agents/skills/` — READ-ONLY)
These are upstream, hash-verified third-party skills. Never edit in place.

- **Firebase Suite:** `firebase-security-rules-auditor`, `firebase-firestore`, `firebase-auth-basics`, `firebase-basics`, `firebase-ai-logic-basics`, `firebase-crashlytics`, `firebase-data-connect`, `firebase-hosting-basics`, `firebase-app-hosting-basics`, `firebase-remote-config-basics`
- **AI/SDK:** `developing-genkit-js`, `developing-genkit-python`
- **Security:** `arcjet`
- **UI Patterns:** `react-call` (standardized awaited dialogs)

### Proprietary Skills (`skills/`)
Mission-critical, indii-built product specs that double as skills.

- `direct-distribution` — Direct Distribution Engine (Industrial V3): DDEX ERN 4.3, Aspera/Transporter delivery, QC forensics, ISRC authority, tax/payout, Merlin/MLC

---

## How to Use

**As an Agent (Self-Selection):**

When you encounter a task, follow this decision tree:

```
Is it a test problem?
  → Use test or auto_qa

Is it a design/architecture problem?
  → Use agentic-harness-architect or zoom-out

Is it a bug?
  → FIRST: Check .agent/skills/error_memory/ERROR_LEDGER.md
  → Then: Use diagnose

Is it a planning/documentation problem?
  → Use to-prd or to-issues

Is it a performance problem?
  → Use diagnose for instrumentation
  → Use hunter for latent perf bugs

Is it a creative/media production task?
  → Use indii-cinema-worldbuilder or indii-director

Need to setup/configure the environment?
  → Use hooks or setup-pre-commit

Need Firebase/Firestore guidance?
  → Use the vendored firebase-* skills

Need to understand complex dependencies?
  → Use zoom-out

Need to validate architecture decisions?
  → Use grill-with-docs to interview the codebase

Polishing or elevating existing work?
  → Use health_audit for a full audit
  → Use health-check for targeted checks

Unsure and want guidance?
  → Use grill-with-docs to interview the codebase
  → Or invoke /skill-skill workflow for workflow-level routing
```

**As a User (Requesting Skill Selection):**

Simply describe your task, and this skill will evaluate available tools and route to the best match. You can also invoke it directly with `/skill-skill` or by reading `.agent/skills/skill – skill/SKILL.md`.

**Workflow-Level Routing:**

For routing to full *workflows* (multi-step orchestration commands like `/start`, `/middle`, `/end`, `/factory`, `/abcd`), invoke the companion workflow at `.agent/workflows/skill-skill.md`. This SKILL.md handles **skill-level** routing; the workflow handles **workflow-level** routing.

## Key Principles

1. **Always check the Error Ledger first** — Never debug blind. See `.agent/skills/error_memory/ERROR_LEDGER.md`.
2. **Match specificity** — Use the most specific skill for the domain. `/go` is for multi-step tasks; `test` is for testing only.
3. **Compose when needed** — Some tasks require multiple skills in sequence (e.g., `diagnose` → `to-issues`).
4. **Delegate upward** — If no skill directly solves it, escalate to `grill-with-docs` for architecture guidance.
5. **Check vendored skills** — Firebase, Genkit, and Arcjet skills exist in `.agents/skills/` and should be used for those domains.

## No Skill Fits?

If the task doesn't map to any existing skill:

1. Read `.agent/skills/error_memory/ERROR_LEDGER.md` for past solutions.
2. Consult `go` skill for recursive problem-solving.
3. Use `health_audit` for systemic issues.
4. If truly novel, document the gap in the ERROR_LEDGER for future agents.
