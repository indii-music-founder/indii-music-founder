---
description: Allow agents to dynamically pick their own skills and workflows based on the task at hand. Can be invoked at any time by user or agent.
---

# /skill-skill — The Intelligent Skill Router

**Activates the meta-cognitive routing system to identify the absolute best workflows and skills for your current goal.**

This command can be dropped in at *any* time by either the user or the agent when a task feels ambiguous, when selecting a workflow, or when an engineering blocker occurs. It scans our command indexes and points you directly to the correct tools.

## 1. Goal & Task Assessment
- **Evaluate Context:** Parse the active goal, modified files, open files, and the state of `task.md` or `implementation_plan.md`.
- **Identify Domain:** Is this a testing issue, database rules adjustment, styling alignment, performance bottleneck, or strategic mapping task?

## 2. Manifest & Skill Scan
Scan our centralized command manifests:
- **Manifest Audit:** Read and evaluate the active `/commands` listed inside [WIIL-skill.md](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/.agent/workflows/WIIL-skill.md).
- **Skill Inventory Audit:** Scan the `.agent/skills/` directory for active underlying domain expertise (e.g. `firebase-security-rules-auditor`, `zoom-out`, `to-prd`).

## 3. Dynamic Parameter & Argument Routing
If the command is invoked with an inline argument (e.g. `/skill-skill [argument]`), bypass standard matrix scanning and execute these direct verification actions:

- **`/skill-skill health check`**
  - **Action:** Run a repository sanity audit. Automatically check TypeScript typing (`npm run typecheck`), lint compliance (`npm run lint`), and ensure there are no orphaned dependencies.
  - **Routing:** Directs immediately to `/devex-review` or `/ci-validate`.

- **`/skill-skill API`**
  - **Action:** Run API integrity checks. Verify standard intelligence models imports (`AI_MODELS` inside configuration), check that `.env` keys exist (without exposing secrets), and scan Firebase functions routing configurations.
  - **Routing:** Validates key safety and prompts active testing setups.

- **`/skill-skill security`**
  - **Action:** Audit database rules and storage isolation parameters.
  - **Routing:** Directs immediately to `/db-sync`.

- **`/skill-skill testing`**
  - **Action:** Resolve test suites matching modified files.
  - **Routing:** Directs immediately to `/test` or `/auto_qa`.

---

## 4. Decision Matrix (Priority Routing)
Evaluate the task against this routing matrix if no specific arguments are passed:
- **Is it a fresh prompt or strategic roadmap?** ➔ `/start` (Genesis Workflow)
- **Is it a resume or compliance question?** ➔ `/proceed` (Resume & Audit)
- **Are we mid-sprint building complex logic?** ➔ `/middle` (Execution Loop via `/go`)
- **Are database rules or storage schemas shifting?** ➔ `/db-sync` (Security Rules Synchronizer)
- **Is there a bug or test failure?** ➔ `/test` (Vitest/Playwright Shard runner)
- **Are we writing high-risk features?** ➔ `/tdd` (Test-Driven Development)
- **Are we analyzing complex import trees?** ➔ `/zoom-out` (Codebase Dependency Mapper)
- **Are we wrapping up work for review?** ➔ `/end` (Closing Protocol via `/ci-validate`)

---

## 5. Prioritized Action Output
Output the decision matrix result in this standardized routing block:
```text
=== SKILL-SKILL ROUTING RECOMMENDATION ===
TASK DOMAIN: [Testing / Refactoring / Security / Strategy]
RECOMMENDED COMMAND: [Command Name, e.g., /db-sync or /proceed]

RATIONALE:
  - [Reasoning 1 mapping codebase constraints]
  - [Reasoning 2 referencing active goals]

NEXT ACTION: [Run recommended command / file-edit target]
```
