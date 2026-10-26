---
description: Human-facing index of indii slash workflows. The generated capability catalog owns health, authority, availability, and automatic-selection state.
---

> [!IMPORTANT]
> **CRITICAL ISSUE TRACKING RULE:**
> You MUST ONLY log issues in `.agent/test_ledger/OPEN_ISSUES_V3.md`. Do NOT create new or standalone markdown files (like BROWSER_ISSUES.md or issue-specific files) for issues.


# WIIL-Skill: Human Command Index

This document keeps the command surface understandable to humans. `.agent/capabilities/catalog.json` is the generated machine-readable source for capability health, authority, availability, hashes, prerequisites, fallbacks, and automatic-selection state. A command listed here is not automatically selectable when the catalog marks it Quarantined or Deprecated.

## The Core Pipeline

These five commands form the backbone of the agent's development workflow.

### `/start` — The Genesis Workflow
- **Purpose:** Initializes a new session, feature, or prompt.
- **Actions:** Classifies request mode/profile/authority, reconciles relevant state, selects a healthy toolchain via `/skill-skill`, and defines observable completion. `/opp`, health checks, and diagrams are proportional rather than automatic.
- **When to use:** At the very beginning of any task.

### `/proceed` — The Resume & Audit Gate
- **Purpose:** Resumes an active task and runs a comprehensive compliance check before editing code.
- **Actions:** Reconciles the current request, actual diff/mainline state, handoff trust, authority, prerequisites, and the first unverified acceptance criterion before editing.
- **When to use:** Whenever the user says "continue", or when resuming work after an interruption.

### `/middle` — The Execution Engine
- **Purpose:** Drives the iterative coding and building process.
- **Actions:** Executes the certified toolchain in coherent verification units via `/go`, validates cross-boundary contracts, and uses error memory or diagrams only when relevant.
- **When to use:** During the active development phase of a task.

### `/end` — The Closing Protocol
- **Purpose:** Wraps up a session leaving a pristine repository.
- **Actions:** Reconciles acceptance evidence, updates only relevant durable artifacts, runs observational `/ci-validate`, and delivers one coherent direct-main commit with exact-SHA CI when authorized.
- **When to use:** When the task is complete and ready to be merged or handed off.

### `/skill-skill` — The Intelligent Skill Router
- **Purpose:** Canonical capability planner that selects the minimal sufficient healthy toolchain for any goal.
- **Actions:** Classifies intent and authority, reads the generated catalog, overlays tools actually available in the current host, checks prerequisites/fallbacks, and executes inside existing authority.
- **When to use:** At any point when routing is ambiguous, specialized tools are likely, a preferred tool is unavailable, or several capabilities must be sequenced safely.

---

## Utility & Verification Commands

These commands are called by the Core Pipeline or can be invoked directly as needed.

### `/review` — Specialization & Context Alignment
- **Purpose:** Activates a conversational Q&A loop to review current state, clarify ambiguity, and specialize the agent's persona.
- **When to use:** Use to set up the agent in a new chat or to pause and review a drifted conversation mid-session.

### `/opp` — Operator Persona Activation
- **Purpose:** Comprehensive environment audit and handoff state check.
- **When to use:** Use selectively when the handoff/environment context is stale or missing; `/start` does not require the full scan for every T0/T1 task.

### `/go` — Recursive Execution Loop
- **Purpose:** Universal recursive execution loop for task continuation and unsticking blocked agents.
- **When to use:** Used automatically by `/middle`. Can be invoked directly to force the agent to push through a blocker.

### `/get-git` — Git Repository Sync & Monitor
- **Purpose:** Legacy combined sync/scheduling/delivery workflow. It is quarantined in the capability catalog until its responsibilities are separated.
- **When to use:** Do not auto-select. Use `branch-safety.md` for mainline state, `/end` for delivery, and `/away` for exact-SHA monitoring.

### `/c` — Continuous Coordination Engine
- **Purpose:** Legacy persistent supervisor. Quarantined because it combines unrelated mutation, issue, and delivery authority.
- **When to use:** Do not auto-select; redesign the workflow before reuse.

### `/away` — Autonomous Main CI Monitor
- **Purpose:** Monitors the exact CI run for the latest direct `main` push, fixes logged root causes one coherent commit at a time, and stops when `main` is green.
- **When to use:** When the user steps away and wants the agent to drive the current `main` delivery across the finish line.

### `/ci-validate` — Pre-Push CI Validation
- **Purpose:** Observational local validation plus exact-SHA remote delivery proof. It does not fix, commit, push, or rewrite secrets.
- **When to use:** Used automatically by `/end`. Must be run before any push to `main`.

### `/flowchart` — Dynamic Architecture & Flow Visualizer
- **Purpose:** Dynamic flowchart and visual diagram engine using Mermaid.
- **When to use:** When state, ownership, hierarchy, or multi-step flow is materially clearer as a diagram. Save only when the task calls for a durable repository artifact.

### `/db-sync` — Security Rules & Schema Auditor
- **Purpose:** Scans codebase changes against firestore.rules and storage.rules to audit access privileges and prevent security leaks.
- **When to use:** Used automatically in `/middle` when schemas shift, or manually before checking in rule modifications.

### `/auto-fix` — Legacy External Auto-Fix (Quarantined)
- **Purpose:** Historical combined Sentry/CodeRabbit/fix/delivery workflow. The catalog blocks automatic selection because its authority is too broad.
- **When to use:** Quarantined pending separation of credential, external-issue, fix, and delivery authority. Never auto-run inside `/ci-validate`.

### `/hunter` — Legacy Slash Hunter (Quarantined)
- **Purpose:** Historical broad auto-fix workflow. Use the contract-controlled owned `hunter` skill instead.
- **When to use:** Use the owned `hunter` skill for an explicitly bounded broad audit/fix request. The legacy slash workflow is quarantined and never auto-runs inside `/ci-validate`.

### `/issue-sweep` — Legacy External Issue Sweep (Quarantined)
- **Purpose:** Historical cross-service issue/fix/test sweep whose credential, ledger, and mutation scope is too broad.
- **When to use:** Do not auto-select; replace with a named, bounded issue or authenticated connector task.

### `/better` — Universal Improvement Engine
- **Purpose:** Audits, elevates, and polishes whatever you're currently working on. Checks style alignment, performance, and formatting.
- **When to use:** Can be invoked manually anytime. In the automated pipeline it runs in exactly two places: per-task inside `/go` (Step 5, scoped to the files just modified) and once in `/end` before `/ci-validate`. No other workflow auto-invokes it — chained auto-polish passes were removed to stop redundant triple-audits of the same files.

### `/finish` — Legacy Unfinished Work Sweep (Quarantined)
- **Purpose:** Historical sweep that converts broad pattern matches into permanent ledger mutations.
- **When to use:** Use a bounded read-only audit instead until the workflow is re-certified.

### `/devex-review` — Legacy Developer Experience Audit (Quarantined)
- **Purpose:** Historical audit that also auto-fixes, moves, or deletes files.
- **When to use:** Do not auto-select until observation and implementation modes are separated.

### `/factory` — Legacy Overnight Loop (Quarantined)
- **Purpose:** Historical test/fix/deploy loop whose mutation, credential, and deployment boundaries are not narrow enough for automatic routing.
- **When to use:** Do not auto-select. Redesign it as bounded monitoring and logged-cause repair before re-certification.

### `/test` — Context-Aware Test Runner
- **Purpose:** Automatically identify and run relevant tests based on current modified files.
- **When to use:** When writing code that needs quick unit/E2E verification before the final gauntlet.

### `/training` — AI Agent Dataset Generation & Fine-Tuning
- **Purpose:** Executes the dataset generation (using local scripts) and safely orchestrates cloud AI fine-tuning jobs for the multi-agent hub-and-spoke system.
- **When to use:** When preparing harness datasets or when explicit user approval is granted to incur model training costs.

### `/api` — The API Knowledge Base
- **Purpose:** Serves as the ultimate reference and diagnostic tool for the entire API system (Firebase Cloud Functions, AI logic, Inngest Jobs, etc.).
- **When to use:** When discovering, debugging, or planning to add new API endpoints.

---

## Creative, Design & Architectural Skills

These skills reside inside `.agent/skills/` and are actively used by the agent swarm for design, architectural planning, and feature mapping.

### `/to-prd` — Product Requirement Document (PRD) Generator
- **Purpose:** Compiles current conversation, goals, evidence, and technical boundaries into a local PRD draft; publishing requires a separate explicit external-write request.
- **When to use:** At the very beginning of a feature design process.

### `/to-issues` — Vertical-Slice Ticketer
- **Purpose:** Breaks plans or PRDs into dependency-ordered issue drafts; tracker publication requires a separate explicit external-write request.
- **When to use:** After generating an implementation plan to create actionable TODOs.

### `/grill-me` — Architect Interviewer
- **Purpose:** Challenges and refines your implementation strategies and ADR decisions through a rigorous mock interview.
- **When to use:** When aligning on technical strategy before writing code.

### `/zoom-out` — Codebase Dependency Mapper
- **Purpose:** Recursively maps file dependencies, imports, and callers to prevent regressions in adjacent components.
- **When to use:** Before refactoring existing codebase logic or service layers.

### `/tdd` — Test-Driven Development Loop
- **Purpose:** Launches a strict Red-Green-Refactor loop to ensure robust test coverage.
- **When to use:** When writing high-risk logical functions or services.

---

## External & Vendored Skill Registries

Beyond `.agent/skills/`, three additional skill registries exist. The generated catalog records repository-visible entries and treats host/user-global entries as runtime overlays.

### `.agents/skills/` — Vendored Third-Party Skills (READ-ONLY)
- **What:** Upstream skills installed from GitHub (`firebase/agent-skills`, `arcjet/skills`) and pinned by `skills-lock.json` (source + content hash per skill).
- **Contents:** `firebase-security-rules-auditor` (used by `/db-sync`), `firebase-firestore`, `firebase-auth-basics`, `firebase-basics`, `firebase-ai-logic-basics`, `firebase-crashlytics`, `firebase-data-connect`, `firebase-hosting-basics`, `firebase-app-hosting-basics`, `firebase-remote-config-basics`, `developing-genkit-js`, `developing-genkit-python`, `arcjet`.
- **Rule:** NEVER edit these files in place — they are hash-verified and will be overwritten on update. Update from upstream via the skills installer, which also rewrites `skills-lock.json`.

### `skills/` — Proprietary Product Skills
- **What:** Indii-built, mission-critical product specs that double as skills.
- **Contents:** `direct-distribution` — the Direct Distribution Engine (Industrial V3): DDEX ERN 4.3, Aspera/Transporter delivery, QC forensics, ISRC authority, tax/payout, Merlin/MLC. Pairs with `directives/direct_distribution_engine.md`.
- **Rule:** Editable, but treat as covenant documents — keep implementation status tables truthful.

### `~/.agents/skills/` + `.agents/workflows/graphify.md` — Graphify (User-Global)
- **What:** `/graphify` turns a folder into a navigable knowledge graph (`graphify-out/`). The repo carries the workflow pointer and rules (`.agents/rules/graphify.md`); the skill itself lives in the user's home directory and may not exist on every machine.
- **Rule:** Prefer graphify MCP tools / CLI over grep for cross-module architecture questions when `graphify-out/` exists.

---

## Testing & Quality Assurance Commands

### `/mega` — Legacy Mega Stress Test Orchestrator (Quarantined)
- **Purpose:** Historical indefinite live sweep tied to stale ledgers and environment assumptions.
- **When to use:** Do not auto-select; use a bounded authenticated visual QA plan until re-certified.

### `/mega-test` — Legacy Single Mega Test Plan (Quarantined)
- **Purpose:** Historical per-item live test tied to stale ledgers and technology snapshots.
- **When to use:** Do not auto-select until its registry, authenticity, cost, and evidence contracts are current.

### `/real` — Adaptive Real-Life Testing
- **Purpose:** Adaptive real-life testing workflow acting as a real user with real assets.
- **When to use:** To realistically exhaust the system until completion or failure.

### `/auto_qa` — Autonomous Visual QA
- **Purpose:** Uses an approved available browser capability to inspect the exact environment, capture decisive screenshots/DOM evidence, and report the honest proof level.
- **When to use:** Triggered when a build completes or when visual verification is needed.

### `/issue` — Legacy Fix Agent (Quarantined)
- **Purpose:** Historical combined ledger triage/fix/sync workflow with contradictory test requirements.
- **When to use:** Use `diagnose` plus `/middle` for an explicitly named issue until the workflow is re-certified.

---

*(Note: Any legacy `/live_test_*.md` files or undocumented one-off commands have been deprecated in favor of this standardized suite).*
> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
