---
description: Allow agents to dynamically pick their own skills and workflows based on the task at hand. Can be invoked at any time by user or agent.
---

# /skill-skill — The Intelligent Skill Router

**Activates the meta-cognitive routing system to identify the absolute best workflows and skills for your current goal.**

This command can be dropped in at *any* time by either the user or the agent when a task feels ambiguous, when selecting a workflow, or when an engineering blocker occurs. It scans our command indexes and points you directly to the correct tools.

## 1. Goal & Task Assessment
- **Evaluate Context:** Parse the active goal, modified files, open files, and the state of `task.md` or `implementation_plan.md`.
- **Identify Domain:** Is this a testing issue, database rules adjustment, styling alignment, performance bottleneck, deployment concern, architecture question, or strategic mapping task?
- **Reconcile issue identity before routing:** When issue work is in scope, read the active ledger and any referenced archive. Verify that every issue identifier resolves to one subject only; treat a duplicate identifier, stale status, or contradictory evidence as a ledger-integrity defect. Normalize the map before selecting implementation work so a fix cannot be credited to the wrong issue.
- **Distinguish code proof from external proof:** A passing local test proves only its local contract. Route deployment, billing, partner-delivery, legal-registration, or authenticated endpoint acceptance to a controlled live verification step, and retain `PARTIAL` until that evidence exists.

## 2. Manifest & Skill Scan
Scan our centralized command manifests:
- **Manifest Audit:** Read and evaluate the active `/commands` listed inside [WIIL-skill.md](WIIL-skill.md) (same directory: `.agent/workflows/WIIL-skill.md`).
- **Skill Inventory Audit:** Scan ALL FOUR skill registries — they serve different purposes:
  1. `.agent/skills/` — indii-authored skills (e.g. `zoom-out`, `to-prd`, `hunter`, `walk`, `diagnose`, `health-check`). Editable, owned by us.
  2. `.agents/skills/` — **vendored third-party skills** pinned by `skills-lock.json` (e.g. `firebase-security-rules-auditor`, `firebase-firestore`, `developing-genkit-js`, `arcjet`, `react-call`). **READ-ONLY:** never edit in place — they are hash-verified and overwritten on update. To change one, update it from upstream via the skills installer.
  3. `skills/` — proprietary product skills (e.g. `direct-distribution` — the Direct Distribution Engine V3 spec). Editable, mission-critical.
  4. `~/.agents/skills/` — user-global skills (e.g. `graphify`, invoked by `.agents/workflows/graphify.md`). Machine-specific; do not assume present.

## 3. Dynamic Parameter & Argument Routing
If the command is invoked with an inline argument (e.g. `/skill-skill [argument]`), bypass standard matrix scanning and execute these direct verification actions:

- **`/skill-skill health check`**
  - **Action:** Run a repository sanity audit. Automatically check TypeScript typing (`npm run typecheck`), lint compliance (`npm run lint`), and ensure there are no orphaned dependencies.
  - **Routing:** Directs immediately to `/devex-review` or `/ci-validate`.

- **`/skill-skill API`**
  - **Action:** Run API integrity checks. Verify standard intelligence models imports (`AI_MODELS` inside configuration), check that `.env` keys exist (without exposing secrets), and scan Firebase functions routing configurations.
  - **Routing:** Validates key safety and directs to `/api` for deep diagnostics.

- **`/skill-skill security`**
  - **Action:** Audit database rules and storage isolation parameters.
  - **Routing:** Directs immediately to `/db-sync`.

- **`/skill-skill testing`**
  - **Action:** Resolve test suites matching modified files.
  - **Routing:** Directs immediately to `/test` or `/auto_qa`.

- **`/skill-skill architecture`**
  - **Action:** Analyze component dependencies, import trees, and architectural boundaries.
  - **Routing:** Directs to `/zoom-out` for mapping, or `grill-with-docs` skill for ADR-based review.

- **`/skill-skill deployment`**
  - **Action:** Assess CI pipeline state and deployment readiness.
  - **Routing:** Directs to `/ci-validate` for pre-push validation, `/get-git` for sync, or `/away` for autonomous merge loops.

- **`/skill-skill performance`**
  - **Action:** Profile runtime performance, audit bundle size, and check for memory leaks or unnecessary re-renders.
  - **Routing:** Directs to `/diagnose` skill for instrumentation, or `/hunter` for latent perf bugs.

- **`/skill-skill creative`**
  - **Action:** Route to creative and media production tools.
  - **Routing:** Directs to `indii-cinema-worldbuilder` or `indii-director` skills for cinematic/media work.

- **`/skill-skill documentation`**
  - **Action:** Convert plans, conversations, or architecture into formal documentation.
  - **Routing:** Directs to `/to-prd` for PRDs, `/to-issues` for issue tickets, or `/flowchart` for visual diagrams.

- **`/skill-skill git`**
  - **Action:** Manage the single `main` delivery lane and validate its one pending commit; branches require an explicit user request.
  - **Routing:** Directs to `/get-git` for sync and push validation.

---

## 4. Decision Matrix (Priority Routing)
Evaluate the task against this routing matrix if no specific arguments are passed:

### Core Pipeline
- **Is it a fresh prompt or strategic roadmap?** ➔ `/start` (Genesis Workflow)
- **Is it a resume or compliance question?** ➔ `/proceed` (Resume & Audit)
- **Are we mid-sprint building complex logic?** ➔ `/middle` (Execution Loop via `/go`)
- **Are we wrapping up work for review?** ➔ `/end` (Closing Protocol via `/ci-validate`)
- **Need to onboard the agent or realign focus?** ➔ `/review` (Specialization & Context Alignment)
- **Has the agent lost environment context?** ➔ `/opp` (Operator Persona Activation)

### Quality & Testing
- **Is there a bug or test failure?** ➔ FIRST check `.agent/skills/error_memory/ERROR_LEDGER.md` (mandatory, per agent instructions Rule 5), THEN `/test` (Vitest/Playwright Shard runner)
- **Hunting for latent bugs across the whole stack?** ➔ `/hunter` (Full-Spectrum Bug Hunter)
- **Stress-testing the live app like a user?** ➔ `/mega` (structured) or `/real` (freeform)
- **Running a specific numbered Mega Stress Test plan?** ➔ `/mega-test` (Single Mega Test Plan)
- **Need visual UI verification?** ➔ `/auto_qa` (Autonomous Visual QA)
- **Are we writing high-risk features?** ➔ `tdd` skill (Red-Green-Refactor — invoked via `.agent/skills/tdd/SKILL.md`)
- **Polishing a feature that already works?** ➔ `/better` (Elevation Engine)
- **Sweeping for TODOs, stubs, and AI slop?** ➔ `/finish` (Unfinished Work Sweep)
- **Need a daily health check (integration tests, Sentry, dashboard)?** ➔ `/health_audit` (Daily Health Check)

### Operations & CI
- **About to push the coherent `main` commit?** ➔ `/plat` (Platinum pre-push gate — `.claude/commands/plat.md`)
- **Need pre-push CI validation?** ➔ `/ci-validate` (Full 4-shard test run with commit consolidation)
- **Need git sync, fetch, or push validation?** ➔ `/get-git` (Git Repository Sync & Monitor)
- **Stepping away and want autonomous CI monitoring?** ➔ `/away` (Autonomous CI Monitor & Merge Loop)
- **Want a fully automated overnight test-fix-deploy loop?** ➔ `/factory` (Automated Test & Fix Loop)
- **Clearing the issue backlog in `OPEN_ISSUES.md`?** ➔ `/issue` (The Fix Agent)
- **Sweeping CodeRabbit and Sentry after a big block of work?** ➔ `/issue-sweep` (End-to-End Issue Sweep)
- **Reconciling a new active ledger with an archive or correcting issue IDs?** ➔ `/start`, then `/issue-sweep` in plan/reconciliation mode before changing product code.
- **Need to auto-patch Sentry/CodeRabbit issues?** ➔ `/auto-fix` (Auto-Fix Sentry & CodeRabbit)
- **Are database rules or storage schemas shifting?** ➔ `/db-sync` (Security Rules Synchronizer)

### Architecture & Strategy
- **Are we analyzing complex import trees?** ➔ `zoom-out` skill (Codebase Dependency Mapper — invoked via `.agent/skills/zoom-out/SKILL.md`)
- **Need to map architecture visually?** ➔ `/flowchart` (Dynamic Architecture & Flow Visualizer)
- **Need a full coordinated test/build/CI/CD swarm?** ➔ `/abcd` (Full ABCD Engine Launch)
- **Running the individual ABCD engines directly?** ➔ `/a` (Finder), `/b` (Fixer), `/c` (Shipper), `/d` (Verifier)
- **Discovering, debugging, or planning API endpoints?** ➔ `/api` (The API Knowledge Base)
- **Preparing AI agent training datasets?** ➔ `/training` (AI Agent Dataset Generation & Fine-Tuning)
- **DX feeling sluggish?** ➔ `/devex-review` (Developer Experience Audit)
- **Does a tool persist financial, legal, or job-state intent without a verified worker?** ➔ `/middle` → `/go` with TDD and the relevant persistence/security skill; model the full state machine and approval boundary rather than returning a queued or completed claim.
- **Does a deployed private SSE/API path need authentication proof?** ➔ `/api`, then a bounded controlled live probe; verify identity binding, reconnect behavior, and unauthorized denial without relaxing access controls.

---

## 5. Prioritized Action Output
Output the decision matrix result in this standardized routing block:
```text
=== SKILL-SKILL ROUTING RECOMMENDATION ===
TASK DOMAIN: [Testing / Refactoring / Security / Strategy / Deployment / Architecture / Creative / Operations]
RECOMMENDED COMMAND: [Command Name, e.g., /db-sync or /proceed]

RATIONALE:
  - [Reasoning 1 mapping codebase constraints]
  - [Reasoning 2 referencing active goals]

NEXT ACTION: [Run recommended command / file-edit target]
```
> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
