---
description: The master manifest of all approved, global /commands for the agent swarm.
---

# WIIL-Skill: The Master Command Manifest

This document serves as the single source of truth for all active, approved `/commands` and workflows available to the agent swarm. If a command is not listed here, it is considered deprecated or obsolete.

## The Core Pipeline

These five commands form the backbone of the agent's development workflow.

### `/start` — The Genesis Workflow
- **Purpose:** Initializes a new session, feature, or prompt.
- **Actions:** Scans environment, checks handoff states (via `/opp`), asks clarifying questions, and maps macro-level architecture (via `/flowchart`).
- **When to use:** At the very beginning of any task.

### `/proceed` — The Resume & Audit Gate
- **Purpose:** Resumes an active task and runs a comprehensive compliance check before editing code.
- **Actions:** Syncs handoff checkpoints, reviews git diff, runs checks for Anti-Laziness, security keys, model constants, and CSS alignment.
- **When to use:** Whenever the user says "continue", or when resuming work after an interruption.

### `/middle` — The Execution Engine
- **Purpose:** Drives the iterative coding and building process.
- **Actions:** Reads `task.md`, executes the recursive build loop (via `/go`), resolves blockers using the Error Ledger, and maps technical state logic (via `/flowchart`).
- **When to use:** During the active development phase of a task.

### `/end` — The Closing Protocol
- **Purpose:** Wraps up a session leaving a pristine repository.
- **Actions:** Summarizes learnings, updates checkpoints, finalizes architecture flowcharts, and runs the entire testing and verification gauntlet (via `/ci-validate`).
- **When to use:** When the task is complete and ready to be merged or handed off.

### `/skill-skill` — The Intelligent Skill Router
- **Purpose:** Dynamic search and decision gate that selects and matches the perfect tool, skill, or workflow for any goal.
- **Actions:** Evaluates active context, checks available manifests (WIIL-skill) and skills inventory, and outputs prioritized routing recommendations.
- **When to use:** At any point during a session when you need guidance, have architectural questions, or need to decide on the next workflow.

---

## Utility & Verification Commands

These commands are called by the Core Pipeline or can be invoked directly as needed.

### `/review` — Specialization & Context Alignment
- **Purpose:** Activates a conversational Q&A loop to review current state, clarify ambiguity, and specialize the agent's persona.
- **When to use:** Use to set up the agent in a new chat or to pause and review a drifted conversation mid-session.

### `/opp` — Operator Persona Activation
- **Purpose:** Comprehensive environment audit and handoff state check.
- **When to use:** Used automatically by `/start`. Can be run manually if the agent loses context.

### `/go` — Recursive Execution Loop
- **Purpose:** Universal recursive execution loop for task continuation and unsticking blocked agents.
- **When to use:** Used automatically by `/middle`. Can be invoked directly to force the agent to push through a blocker.

### `/ci-validate` — Pre-Push CI Validation
- **Purpose:** Comprehensive pre-push CI validation with commit consolidation to prevent bloat.
- **When to use:** Used automatically by `/end`. Must be run before any push to `main`.

### `/flowchart` — Dynamic Architecture & Flow Visualizer
- **Purpose:** Dynamic flowchart and visual diagram engine using Mermaid.
- **When to use:** Used automatically by `/start`, `/middle`, and `/end`. Can be invoked anytime to map out complex architecture. Always saves to `docs/flowcharts/`.

### `/db-sync` — Security Rules & Schema Auditor
- **Purpose:** Scans codebase changes against firestore.rules and storage.rules to audit access privileges and prevent security leaks.
- **When to use:** Used automatically in `/middle` when schemas shift, or manually before checking in rule modifications.

### `/auto-fix` — Auto-Fix Sentry & CodeRabbit
- **Purpose:** Automatically fetch and fix Sentry issues and CodeRabbit PR comments.
- **When to use:** Used automatically within `/ci-validate`.

### `/hunter` — Full-Spectrum Bug Hunter
- **Purpose:** Surfaces security, data integrity, performance, and correctness issues across the stack.
- **When to use:** Used automatically within `/ci-validate`.

### `/issue-sweep` — End-to-End Issue Sweep
- **Purpose:** Full closed-loop cycle of fixing all CodeRabbit/Sentry issues, validating, and generating tests.
- **When to use:** Run after any significant block of work or when focusing on stabilization.

### `/better` — Universal Improvement Engine
- **Purpose:** Audits, elevates, and polishes whatever you're currently working on. Checks style alignment, performance, and formatting.
- **When to use:** Drop it anywhere during execution to polish a feature.

### `/devex-review` — Developer Experience Audit
- **Purpose:** Comprehensive Developer Experience audit to ensure coding environment, aliases, and dependencies are optimized.
- **When to use:** Run periodically to keep DX (Developer Experience) at 10/10.

### `/factory` — Automated Test & Fix Loop
- **Purpose:** Spins up test orchestrators, fix agents, and CI publishers to run overnight systems, auto-patch bugs, and deploy.
- **When to use:** For completely autonomous overnight quality loops.

### `/test` — Context-Aware Test Runner
- **Purpose:** Automatically identify and run relevant tests based on current modified files.
- **When to use:** When writing code that needs quick unit/E2E verification before the final gauntlet.

### `/training` — AI Agent Dataset Generation & Fine-Tuning
- **Purpose:** Executes the dataset generation (using local scripts) and safely orchestrates cloud AI fine-tuning jobs for the multi-agent hub-and-spoke system.
- **When to use:** When preparing harness datasets or when explicit user approval is granted to incur model training costs.

---

## Creative, Design & Architectural Skills

These skills reside inside `.agent/skills/` and are actively used by the agent swarm for design, architectural planning, and feature mapping.

### `/to-prd` — Product Requirement Document (PRD) Generator
- **Purpose:** Compiles current conversation, goals, and technical boundaries into a formal PRD.
- **When to use:** At the very beginning of a feature design process.

### `/to-issues` — vertical-Slice Ticketer
- **Purpose:** Breaks down complex implementation plans or PRDs into vertical-slice issue tickets that agents can grab.
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

## Testing & Quality Assurance Commands

### `/mega` — Mega Stress Test Orchestrator
- **Purpose:** Master orchestrator for Mega Stress Tests (V1–V7+). Cycles through test plans on a loop.
- **When to use:** For continuous, multi-hour gauntlets simulating sustained real-user abuse.

### `/mega-test` — Single Mega Test Plan
- **Purpose:** Executes a specific version of the Mega Stress Test Plan using the browser subagent.
- **When to use:** When testing a specific, numbered routine from the Mega suite.

### `/real` — Adaptive Real-Life Testing
- **Purpose:** Adaptive real-life testing workflow acting as a real user with real assets.
- **When to use:** To realistically exhaust the system until completion or failure.

### `/auto_qa` — Autonomous Visual QA
- **Purpose:** Uses the browser subagent to visually inspect the live app, capture screenshots, and report results.
- **When to use:** Triggered when a build completes or when visual verification is needed.

### `/issue` — The Fix Agent
- **Purpose:** Scans `OPEN_ISSUES.md` for unresolved issues logged by test agents, diagnoses, and fixes them.
- **When to use:** The counterpart to the test agents. Runs surgically to clear the issue backlog.

---

*(Note: Any legacy `/live_test_*.md` files or undocumented one-off commands have been deprecated in favor of this standardized suite).*
