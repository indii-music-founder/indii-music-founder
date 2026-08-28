# Agent Instructions

> This file is mirrored across **CLAUDE.md**, **GEMINI.md**, **DROID.md**, **JULES.md**, **CODEX.md**, and **ANTIGRAVITY.md** to ensure architectural consistency across all AI environments. CLAUDE.md is the canonical source — edit it first, then copy verbatim to the other five.
>
> **Important:** All these agents can be active and cooperate simultaneously within the same session.

---

## Your Team Structure

**You are:** Solo operator + IDE + agent swarm (Claude, Gemini, DROID, JULES, CODEX)

**Our role:** Execute your intent with guardrails that prevent mistakes, learn your patterns from memory, anticipate your needs.

**How you work:** Fast, parallel agents, consolidation before push. You don't have time for friction — the system removes it.

**What we expect:** Trust our routing decisions. Use `/skill – skill` as your primary entry point. We get smarter with every session.

---

---

## MANDATORY SESSION BOOTSTRAP

> This section is non-negotiable. There are no lifecycle hooks in this environment —
> **you must execute this manually at the start of every session, before anything else.**

### Step 1 — Read the handoff

```bash
cat .agent/HANDOFF_STATE.md
```

Summarize what was last built, what branch you're on, and what's pending.

### Step 2 — Detect machine state

```bash
echo "node_modules: $(ls node_modules 2>/dev/null | wc -l) packages"
git status --short
git branch --show-current
```

### Step 3 — Route accordingly

**If `node_modules` is empty or absent** (fresh machine, likely just got home from a mobile session):

> Read `.agent/skills/walk/SKILL.md` and execute the full protocol immediately.
> Do not wait to be asked. The user is home. Drive to prime.

**Otherwise:**

> Brief the user: "Last session was on [date/branch]. You built [X]. Still pending: [Y]. How do you want to proceed?"

### Step 4 — Session end (before every sign-off)

Always run this before ending a session so the next machine picks up cleanly:

```bash
bash .claude/scripts/checkpoint.sh
```

---

## Project Overview

> **Canonical product documentation lives in `.agent-os/product/`. Read those 5 files first before acting on instructions in this file.**

**indii** is an AI-native music business platform for independent music artists — the first of its kind. It picks up where music mastering ends. Not built for major labels, major managers, or major artists.

- **Version:** 1.80.1
- **Org:** New Detroit Music LLC
- **Repo:** `indii-music-founder/indii-music-founder`
- **Node Requirement:** >= 24.0.0

---

## The 3-Layer Architecture

You operate within a 3-layer architecture designed to maximize reliability by separating deterministic logic from probabilistic reasoning.

### Layer 1: Directive (The Blueprint)

- **Content:** Natural language Standard Operating Procedures (SOPs) stored in `directives/`.
- **Purpose:** Defines specific goals, required inputs, tool selection, expected outputs, and robust edge-case handling.
- **Role:** Provides the high-level strategy, much like a manager giving instructions to a specialized employee.

**Available Directives:**

- `agent_stability.md` - Agent reliability standards
- `architecture_standard.md` - Architectural guidelines
- `direct_distribution_engine.md` - Distribution engine SOP
- `font_consistency.md` - UI consistency rules
- `git_sync.md` - Version control procedures

### Layer 2: Orchestration (Decision Making)

- **Content:** The AI agent's reasoning loop (You).
- **Purpose:** Performs intelligent task routing, sequences tool calls, handles runtime errors, and requests clarification when intent is ambiguous.
- **Role:** Acts as the "glue" between human intent and machine execution. You do not perform heavy lifting directly; you interpret a `directive/` (e.g., `scrape_website.md`) and orchestrate the necessary `execution/` scripts.

### Layer 3: Execution (The Action)

- **Content:** Deterministic Python/TypeScript scripts and tools stored in `execution/`.
- **Purpose:** Handles API interactions, complex data processing, file system operations, and database state changes.
- **Role:** Ensures reliable, testable, and high-performance outcomes. Complexity is pushed into code so that the agent can focus on high-level decision-making.

**The Multiplier Effect:** By pushing complexity into deterministic execution layers, we avoid the "compound error" trap (where 90% accuracy over 5 biological steps leads to failure). Determinism at the base allows for reliability at the peak.

---

## Codebase Structure

```
indii-music-founder/
├── packages/
│   ├── renderer/               # Main React application source (indii studio)
│   ├── main/                   # Electron desktop wrapper
│   ├── firebase/               # Firebase Cloud Functions (Node.js 22, Gen 2)
│   ├── shared/                 # Shared types and schemas
│   ├── landing/                # Separate marketing site (React + Vite)
│   ├── sdk/                    # SDKs
│   └── mcp-server-local/       # Local MCP server
├── agents/                     # AI agent definitions (A2A Swarm Protocol)
├── execution/                  # Deterministic scripts for agent tools (Layer 3)
├── directives/                 # AI agent SOPs (Layer 1)
├── e2e/                        # Playwright E2E tests (60+ spec files)
├── docs/                       # Documentation (specs, plans, design, testing)
├── .agent/                     # Agent system configuration and error memory
├── docs/                       # Documentation (specs, plans, design, testing)
├── scripts/                    # Build and utility scripts
├── .github/workflows/          # CI/CD (deploy.yml)
└── .agent/                     # Agent system configuration and error memory
```

---

## Tech Stack

### Frontend

| Category | Technology | Notes |
|----------|-----------|-------|
| Framework | React 18.3.1 | With lazy-loaded modules |
| Build | Vite 6.4.1 | Port 4242 for dev |
| Styling | TailwindCSS 4.1.17 | With tailwind-merge, clsx |
| State | Zustand 5.0.8 | Slice-based store pattern |
| Animation | Framer Motion 12.x | |
| Canvas | Fabric.js 6.9 | Image editing |
| Graph Editor | React Flow 11.11 | Workflow automation |
| Audio | Wavesurfer.js 7.11.1 + Essentia.js 0.1.3 + Python (YAMNet ONNX) | Local-first analysis & visualization |
| Video | Remotion 4.0.445 | Video rendering |
| 3D | Three.js 0.182.0 | Via @react-three/fiber |
| Charts | Recharts 3.6 | Data visualization |
| Router | React Router 7.11 | URL sync |
| UI Kit | Radix UI + Lucide icons | Accessible primitives |
| Validation | Zod 3.25 | Schema validation |

### Backend

| Category | Technology | Notes |
|----------|-----------|-------|
| Functions | Firebase Functions 7.0.5 (Gen 2) | Node.js 22 runtime |
| AI | Genkit AI 1.26 (pinned) + @google/genai^1.48.0 | Gemini models |
| Jobs | Inngest 3.46 | Background job orchestration |
| Payments | Stripe 20.1 | Subscription billing |
| Database | Firestore | With security rules |
| Storage | Firebase Storage | With security rules |
| Analytics | BigQuery | Revenue analytics |

### Desktop (Electron 41.1.1)

| Component | Purpose |
|-----------|---------|
| Electron Forge 7.8 / Builder 26.0 | Packaging (DMG, NSIS, AppImage) |
| Keytar 7.9 | OS credential storage |
| SSH2/SFTP | Distributor file uploads |
| FFmpeg / FFProbe | Audio/video processing |

### Testing

| Tool | Purpose |
|------|---------|
| Vitest 4.0.18 | Unit tests (jsdom environment) |
| Playwright 1.58.2 | E2E tests (60+ specs) |
| Testing Library 16.3 | Component testing |
| axe-core 4.11 | Accessibility testing |

---

## Development Commands

### Daily Development

```bash
electron-vite dev              # Start Electron dev server
npm run dev:web                # Start Vite dev server for web-only on :4243
npm run desktop:dev            # Run Electron dev (requires :4242 running)
```

### Building

```bash
npm run build                  # Typecheck + lint + Vite production build
npm run build:studio           # Vite build only (no lint/typecheck)
npm run build:landing          # Build landing page (cd landing-page)
npm run build:all              # Build landing + studio
npm run build:electron         # Bundle Electron main/preload with esbuild
npm run build:desktop          # Full desktop app (all platforms)
npm run build:desktop:mac      # macOS only (DMG/ZIP)
npm run build:desktop:win      # Windows only (NSIS)
npm run build:desktop:linux    # Linux only (AppImage)
```

### Testing

```bash
npm test                       # Run Vitest in watch mode
npm test -- --run              # Run Vitest once (CI mode)
npm test -- --run --coverage   # With coverage report
npm run test:e2e               # Run Playwright E2E tests
```

### Code Quality

```bash
npm run lint                   # ESLint check (.ts, .tsx)
npm run lint:fix               # Auto-fix lint issues
npm run typecheck              # TypeScript type checking (tsc --noEmit)
```

### Deployment

```bash
npm run deploy                 # Build studio + deploy to Firebase hosting (app target)
```

---

## Key Conventions

### Path Aliases

```typescript
import { Something } from '@/services/ai/AIService';    // src/*
import { AgentDef } from '@agents/creative';             // agents/*
```

### State Management (Zustand)

- Root store at `packages/renderer/src/core/store/index.ts`
- Domain slices in `packages/renderer/src/core/store/slices/`:
  - `appSlice.ts` - UI state, current module, navigation
  - `authSlice.ts` - Firebase auth, user state
  - `agentSlice.ts` - Agent orchestration state
  - `creativeSlice.ts` - Creative studio state
  - `distributionSlice.ts` - Distribution pipeline state
  - `fileSystemSlice.ts` - File management state
  - `financeSlice.ts` - Financial data
  - `profileSlice.ts` - User profile
  - `workflowSlice.ts` - Workflow automation state
  - `audioIntelligenceSlice.ts` - Audio analysis state
- Use `useShallow` from `zustand/react/shallow` to prevent unnecessary re-renders

### Module System

- All feature modules are **lazy-loaded** via `React.lazy()` in `packages/renderer/src/core/App.tsx`
- Module components mapped in `MODULE_COMPONENTS` record by `ModuleId`
- Standalone modules (no chrome/sidebar) defined in `STANDALONE_MODULES`
- Each module lives in `src/modules/<name>/` with its own components, hooks, and types

### Component Organization

- Shared UI primitives in `src/components/ui/` (Radix-based)
- Module-specific components in `src/modules/<name>/components/`
- Layout components in `src/components/layout/`

### Dialogs and Modals

- **Standardized on `react-call`**: Use this instead of hand-rolling modal state; never fake a modal.
- Native `window.confirm`, `window.prompt`, and `window.alert` are banned.
- Use the standard awaited dialogs from anywhere in the codebase:
  - `const ok = await ConfirmDialog.call({ message: '...' })`
  - `await AlertDialog.call({ message: '...' })`
  - `const input = await PromptDialog.call({ message: '...' })`

### ESLint Rules

- `@typescript-eslint/no-explicit-any`: warn (not error)
- `@typescript-eslint/no-unused-vars`: warn, with `^_` prefix ignored
- `react-refresh/only-export-components`: warn
- Ignored directories: `dist`, `landing-page`, `functions/lib`, `_archive_legacy`

### TypeScript Configuration

- Target: ES2022, strict mode enabled
- Module resolution: bundler
- JSX: react-jsx
- `noUnusedLocals` and `noUnusedParameters`: disabled (false)

---

## Environment Variables

All frontend env vars use the `VITE_` prefix. Copy `.env.example` to `.env` for local development.

**Required for development:**

- `VITE_API_KEY` - Gemini API key
- `VITE_FIREBASE_API_KEY` - Firebase API key (identifier, not secret)
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_STORAGE_BUCKET` - Storage bucket

**Optional:**

- `VERTEX_PROJECT_ID` / `VERTEX_LOCATION` - backend Vertex AI config
- `VERTEX_IMAGE_LOCATION` / `VERTEX_VIDEO_LOCATION` - backend media routing locations
- `VITE_GOOGLE_MAPS_API_KEY` - Google Maps
- `VITE_SKIP_ONBOARDING` - Skip onboarding in dev
- `VITE_FIREBASE_APP_CHECK_KEY` - App Check (required for production)

---

## Testing Conventions

### Real-User Authenticity (Mandatory)

Before any live-user, browser, end-to-end, release-acceptance, demo-readiness,
production, or free-tier validation, read and obey
`.agent/REAL_USER_AUTHENTICITY.md`.

Never use mocks, seeded product data, bypassed or injected authentication,
impersonated sessions, fabricated service responses, or artificial
plan/tier/entitlement state for those claims. If genuine credentials are
missing, stop and request the official authorization flow. Existing
mock-backed suites are structural checks only and must never be cited as proof
that the real customer path works.

### Unit Tests (Vitest)

- Test setup: `packages/renderer/src/test/setup.ts` - provides centralized Firebase mocks, ResizeObserver/Canvas/matchMedia mocks
- Environment: jsdom with `@testing-library/jest-dom`
- Co-locate tests with source: `*.test.ts` / `*.test.tsx`
- Firebase services are fully mocked (auth, firestore, storage, functions, messaging, app-check, AI)
- indii Conductor replaced AgentZeroService (Native Node.js/TypeScript orchestrator) — see `src/services/agent/orchestration/AgentGraphService.ts`
- Run: `npm test` (watch) or `npm test -- --run` (CI)

### E2E Tests (Playwright)

- Note: Google Antigravity is used for live browser testing alongside Playwright during pre-demo QA.

- Test files in `/e2e/` directory (60+ specs)
- Categories: agent flows, chat interaction, creative persistence, mobile responsiveness, maestro workflows, chaos testing
- Run: `npm run test:e2e`

---

## CI/CD Pipeline

**GitHub Actions** (`.github/workflows/deploy.yml`):

1. Triggered on push to `main` or manual dispatch
2. Node.js 22.x with npm caching
3. Steps: Lint -> Unit tests -> E2E tests -> Build landing -> Build studio -> Deploy to Firebase
4. Two Firebase Hosting targets:
   - `landing` -> `landing-page/dist`
   - `app` -> `dist`
5. Required secrets: `GEMINI_API_KEY`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`, `FIREBASE_SERVICE_ACCOUNT`

### Build Pipeline (`npm run build`)

The `build` script runs three steps sequentially:

1. `npm run typecheck` - TypeScript compiler check
2. `npm run lint` - ESLint
3. `vite build` - Production bundle with terser minification (console/debugger stripped)

---

```
                    ┌─────────────────────────┐
                    │      A2A Swarm          │
                    │   (Decentralized)       │
                    └──────────┬──────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
    ┌───────┴───────┐  ┌───────┴───────┐  ┌───────┴───────┐
    │ Legal Agent   │──│ Creative Agent│──│ Brand Agent   │
    └───────┬───────┘  └───────┬───────┘  └───────┬───────┘
            │                  │                  │
    ┌───────┴───────┐  ┌───────┴───────┐  ┌───────┴───────┐
    │ Marketing Agt │──│ Finance Agent │──│ Music Agent   │
    └───────────────┘  └───────────────┘  └───────────────┘
```

- **A2A Swarm Protocol** - Decentralized P2P delegation via `A2AClient` and `AgentCard` identity.
- **Specialist Agents** - Autonomous domain experts that collaborate directly using `consult_specialist`.
- **Native Execution** - All tools run natively within the Node.js/TypeScript environment with sidecar support.

---

## Operating Principles

### -1. THE MCLEAR RULE (NEVER DECLARE VICTORY)

> **"Never ever ever declare victory ever."**

Before asserting that a problem is fixed, you MUST rigorously verify it from the user's perspective. Do not say "everything is completely fixed" if there are secondary side effects (like wiped local data) that the user will immediately encounter. State the exact status of the fix, acknowledge any new caveats, and never use the word "victory" or its equivalents.


### 0. CAVEMAN MODE (COMMUNICATION EFFICIENCY)

> Token efficiency applies to **communication only**, NEVER to code.

- **Terse Talk:** Adopt the `caveman` communication style for all chat, planning, and explanations. Drop pleasantries, filler words, and over-explanations.
- **Complete Code:** When generating code, you MUST still output 100% functional, complete code with no placeholders. Use chunk-based replacement tools to edit specific blocks of code in-place rather than rewriting entire files.

### 1. Check for tools first

Never reinvent the wheel. Before writing a new script, audit `execution/` for existing tools that fulfill the directive.

### 2. Self-anneal on failure

When a script fails, analyze the stack trace, fix the deterministic code, and re-verify. If a fix involves external costs (tokens/credits), seek user approval before proceeding.

### 3. API SECURITY & CREDENTIALS POLICY

> [!WARNING]
> This is a core architectural policy. Violations are treated as terminal errors.

#### 3.1 Identifiers vs. Secrets

- **Firebase API Keys (`AIza*`):** These are **identifiers**, not secrets. They identify the project for billing and quotas but do not provide authorization. It is safe to include them in code or configuration files.
- **True Secrets:** Service Account JSONs, Stripe Secret Keys, GitHub Tokens (`ghp_*`), and private keys. These must **NEVER** be hardcoded or checked into version control.

#### 3.2 Firebase API Key Best Practices

1. **Security via Rules:** Authorization to backend resources (Firestore, Storage) is controlled via **Firebase Security Rules**, not by hiding the API key.
2. **API Restrictions:** Always apply restrictions in the GCP Console to limit keys to specific APIs (e.g., Identity Toolkit, Firestore).
3. **Service Separation:** Use separate keys for non-Firebase services (like Google Maps) to manage quotas and rotations independently.
4. **Environment Isolation:** Use environment-specific keys (Staging vs. Production) via `.env` files to prevent cross-project interference.
5. **No Client-Side Trust:** Never trust the client-side configuration. Always enforce logic on the server/security rule layer.

#### 3.3 Implementation Pattern

```typescript
// CORRECT - Use environment variables for isolation
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

// TERMINAL VIOLATION - Hardcoding a True Secret
const stripeSecret = "sk_live_...";
```

#### 3.4 Enforcement

1. **Scan:** Self-scan for sensitive secret patterns before completion.
2. **Verify:** Reference the API Credentials Policy (`docs/API_CREDENTIALS_POLICY.md`) for all credential handling.

### 4. API Credentials Policy Compliance (STRICT)

All agents must adhere to the API Credentials Policy (`docs/API_CREDENTIALS_POLICY.md`).

- NO modifications to `.env` or key rotations without explicit user approval.
- Follow the validation checklist before any credential changes.

**Post-Mortem Note (2025-01-17):** A hardcoded Firebase config was found in `scripts/send-reset.js`. This policy exists to prevent future occurrences. There are no exceptions.

### 5. ERROR MEMORY PROTOCOL (MANDATORY)

> Never fix the same error twice. This protocol ensures institutional memory of debugging wins.

Before debugging ANY error, you MUST follow this workflow:

1. **STOP** - Do not immediately attempt a fix.
2. **CHECK LEDGER** - Open `.agent/skills/error_memory/ERROR_LEDGER.md` and search for matching patterns.
3. **CHECK MEM0** - Query `mcp_mem0_search-memories(query="<error message>", userId="indii-errors")`.
4. **APPLY FIX** - If a match is found, apply the documented solution verbatim.
5. **DOCUMENT NEW** - If this is a genuinely new error, add it to the ledger AND mem0 after solving.

**Adding to mem0:**

```javascript
mcp_mem0_add-memory(
  content="ERROR: <pattern> | FIX: <solution> | FILE: <relevant file>",
  userId="indii-errors"
)
```

**Failure to check the ledger first is a protocol violation.**

### 6. PLATINUM QUALITY STANDARDS (MANDATORY FOR EVERY DIFF)

Every code change, review, and agent-authored diff must meet the standards in the platinum documents:

- `docs/PLATINUM_QUALITY_STANDARDS.md` — Code-review / diff discipline. The Nine Anti-Patterns, pre-commit checklist, pitfall library. **Read this before you edit anything.**
- `docs/PLATINUM_POLISH_REPORT.md` — Codebase audit snapshot (type safety, log hygiene, error handling).
- `docs/DATABASE_PLATINUM_PROTOCOL.md` — Database-layer platinum protocol.
- `docs/TOP_50_PLATINUM_RELEASE.md` — Release-readiness checklist.

**Before every `git push`**, run `/plat` (see `.claude/commands/plat.md`). It executes the Pre-commit checklist from `docs/PLATINUM_QUALITY_STANDARDS.md`, cross-references the Error Ledger, and produces an explicit GO / NO-GO verdict. Skipping `/plat` on a substantive branch is treated the same as skipping the Error Ledger check — a protocol violation.

Violations of the Nine Anti-Patterns must be fixed at the root. If you hit a novel variant, add new entries to BOTH `.agent/skills/error_memory/ERROR_LEDGER.md` AND `docs/PLATINUM_QUALITY_STANDARDS.md` before ending the session.

### 7. MERGE CONFLICT HYGIENE (MANDATORY AFTER EVERY MERGE)

> [!CRITICAL]
> Deletion-on-our-side vs. modification-on-their-side conflicts are silently resolved by keeping both. Three-way merge tools default to "keep both" when one side deletes and the other modifies. **You must verify deletions actually stayed deleted.**

**Severity:** High. Stale code with deleted prop names breaks typechecks and blocks CI.

**Root Cause:** After a merge from main (or any base branch), duplicate JSX blocks or stale prop names can be silently resurrected if the merge tool sees conflicting delete/modify operations.

**Prevention Protocol (MANDATORY BEFORE ANY PUSH AFTER A MERGE):**

1. **Grep for duplicates**: `grep -nE '<ComponentName|onPropName'` in any files that were modified during the merge. Look specifically for:
   - Duplicate JSX blocks (same component rendered twice)
   - Stale prop names (props that were intentionally renamed/deleted in your branch)
   
2. **Run the full CI typecheck**: Execute `npm run typecheck` (the exact command from the CI pipeline), NOT local `tsc --noEmit`. The CI command has broader scoping rules.

3. **Inspect the merge diff**: Run `git diff <pre-merge-sha> HEAD -- <modified-file>` to understand the full three-way picture. When you see a deletion symbol (`-`) on your side and a modification on theirs, the merge may have kept both. Always verify the intended delete is gone.

4. **Delete resurrected code**: If you find duplicate blocks or stale props, delete them immediately. These will always cause CI failures.

**Example (PR #1631):** CreativeNavbar.tsx had two `<PromptBuilder>` blocks after merge. The newer one (mine) had `onSetPrompt`, the older one (from main's alternate impl) had the deleted `onPromptImproved` prop. The merge kept both. This broke typecheck with "Property 'onPromptImproved' does not exist." Fix: delete the duplicate inline render block.

**Failure to perform this check after a merge is a protocol violation and will block deployment.**
### 7. ASSET DELETION & PRUNING FAIL-SAFE (STRICT)

> Never suggest deleting skills, workflows, or files simply because they do not appear in a manifest.

Before suggesting the deletion or pruning of any tool, plugin, skill, or workflow to save context tokens, you MUST:
1. **Check for prefixes:** Files/folders prefixed with `indii-` (e.g., `indii-cinema-worldbuilder`, `indii-director`) are explicitly built for this platform.
2. **Check restricted zones:** Treat all files within `.agent/skills/`, `.agent/workflows/`, and `execution/` as MISSION CRITICAL by default.
3. **Ask before acting:** Explicitly ask the user "What is [asset] used for?" before ever classifying it as obsolete or suggesting removal.

Ignorance of a skill's purpose or absence from `WIIL-skill.md` is NOT grounds for deletion.

---



### 8. ISSUE TRACKING & MASTER LEDGER PROTOCOL (MANDATORY)

> [!CRITICAL]
> All issues, test failures, bugs, and tasks MUST be logged into the single master ledger: `.agent/test_ledger/OPEN_ISSUES_V3.md`.

**Prevention Protocol (MANDATORY BEFORE LOGGING ISSUES):**
1. **Never** create standalone issue files (e.g., `BROWSER_ISSUES.md`, `artifacts/*-regression.md`).
2. **Never** log issues to generic `OPEN_ISSUES.md` strings without specifying the exact path.
3. **Always** append directly to `.agent/test_ledger/OPEN_ISSUES_V3.md` (V2 was sealed 2026-08-02 — do not write to it; historical V2 issues live in `.agent/test_ledger/archive/`).

### 9. MULTI-AGENT NPM CONCURRENCY GUARDRAIL (STRICT)

> [!CRITICAL]
> Concurrent agents running `npm install` in the same workspace will shred `node_modules` file locks and corrupt the host machine's global `~/.npm/_cacache` registry, leading to unrecoverable `ENOENT` tarball errors.

**Prevention Protocol (MANDATORY):**
1. **Isolated Caches:** If you MUST run `npm install` (e.g., to fix `ERESOLVE` or missing types), you MUST append an isolated, randomized cache directory: `npm install --cache ./.npm-cache-isolated-$$`
2. **Never Wipe Concurrently:** Never run `rm -rf node_modules` without checking if another agent or process is actively building the workspace. If you wipe it while another agent is compiling, you will break their build.

### 10. SWARM CLI & MCP TOOLKIT INTEGRATION (MANDATORY)

> [!IMPORTANT]
> All agents in the swarm (including JULES, CODEX, Claude, Gemini, etc.) MUST actively utilize and coordinate via the native `firebase` CLI and the Google Cloud `gcloud` CLI for environment verification, function status checks, IAM policies, and logs. Additionally, all agents must remain aware of the active MCP tools (e.g., `firebase-mcp-server`, `cloudrun`, `sentry`, `genkit-mcp-server`) and call them to inspect/verify infrastructure rather than writing ad-hoc scripts.

### 11. NO HARDCODED INFRASTRUCTURE IDENTIFIERS IN THE FRONTEND (STRICT)

> [!CRITICAL]
> Infrastructure-minted identifiers rotate on every re-train/redeploy. Hardcoding them into frontend source is a terminal review failure.

**NEVER** hand-type any of the following into `packages/renderer/` (or any source module): Vertex AI **endpoint IDs**, deployed-model IDs, GCP **project numbers**, **regions/locations**, fine-tuned **tuning-job IDs**, bucket names, or any value an infra system mints and can rotate.

**Why this rule exists (Post-Mortem 2026-06-21):** `packages/renderer/src/services/agent/fine-tuned-models.ts` hardcoded all 20 agents to `locations/us-central1/endpoints/<id>` from the May R8 run. A re-tune minted **new** endpoint IDs in a **different location (`us`)**. The code still compiled and passed its shape-check regex, so it "looked fine" — but every agent would 404 and silently fall back to the base model, meaning NONE of the freshly-trained agents actually served. See `.agent/skills/error_memory/ERROR_LEDGER.md` (2026-06-21 "Stale Hardcoded Fine-Tuned Endpoint Registry") and Platinum Anti-Pattern #9.

**Required pattern:**
1. Infra IDs come from a **single generated/synced config surface** (regenerated from `gcloud ai endpoints list` / the `tuningJobs` REST API after every re-tune) or are resolved at runtime — never scattered literals.
2. If a value must be checked in, it lives in ONE clearly-marked generated file whose header carries the exact regen command. A re-tune must require editing only that one file, never hunting through frontend modules.
3. **After ANY agent re-tune, re-sync the registry from Vertex before claiming agents are live.** Do not trust the checked-in registry — `curl` the live endpoint (`gcloud auth print-access-token` + the `tuningJobs`/`endpoints` REST API) and pick each agent's LATEST `JOB_STATE_SUCCEEDED` job by `endTime`.
4. **Detect before every push:** `grep -rnE "endpoints/[0-9]{6,}|locations/(us|us-central1|global)/|projects/[0-9]{6,}" packages/renderer/src` — any hit outside a test fixture is a defect to fix at the root.

**This rule is enforced by `/plat` and `/better` via Platinum Anti-Pattern #9. Skipping it on a branch that touches agent routing is a protocol violation.**

## Key Files Quick Reference

| File | Purpose |
|------|---------|
| `packages/renderer/src/core/App.tsx` | Main app entry, module routing, lazy loading |
| `packages/renderer/src/core/store/index.ts` | Zustand root store |
| `packages/renderer/src/core/store/slices/` | Domain state slices (app, auth, agent, creative, distribution, etc.) |
| `packages/renderer/src/core/constants.ts` | Module IDs, standalone module list |
| `electron.vite.config.ts` | Build config, path aliases (plus `packages/renderer/vite.config.ts` for web-only), PWA, chunk splitting |
| `tsconfig.json` | TypeScript config (ES2022, strict, bundler resolution) |
| `eslint.config.js` | ESLint flat config with React/TS rules |
| `firebase.json` | Firebase hosting (2 targets), Firestore, Storage config |
| `packages/firebase/firestore.rules` | Firestore security rules |
| `packages/firebase/storage.rules` | Cloud Storage security rules |
| `packages/main/src/main.ts` | Electron main process |
| `packages/main/src/preload.ts` | Electron IPC bridge |
| .env.example | Environment variable template |
| `packages/renderer/src/test/setup.ts` | Vitest global test setup and Firebase mocks |
| `docs/PLATINUM_QUALITY_STANDARDS.md` | Platinum code-review standards — Nine Anti-Patterns, pre-commit checklist |
| `docs/PLATINUM_POLISH_REPORT.md` | Codebase audit snapshot (type safety, log hygiene) |
| `docs/DATABASE_PLATINUM_PROTOCOL.md` | Database-layer platinum protocol |
| `docs/TOP_50_PLATINUM_RELEASE.md` | Release-readiness checklist |
| `.agent/skills/error_memory/ERROR_LEDGER.md` | Living log of past regressions — MANDATORY check before debug |
| `.claude/commands/plat.md` | `/plat` slash command — platinum finishing touches before every push |
| `docs/CHAT_IMAGE_INTERACTION_PLAN.md` | **Living plan** — chat image annotator + Studio handoff + visual verification loop. Update Section 5 (Current State) before ending any session that touches this work. |

---

## Deployment Targets

| Target | Platform | Hosting |
|--------|----------|---------|
| Studio App | Web (SPA) | Firebase Hosting (`app` target) -> `dist/` |
| Landing Page | Web | Firebase Hosting (`landing` target) -> `landing-page/dist/` |
| Desktop (macOS) | Electron | DMG/ZIP distribution |
| Desktop (Windows) | Electron | NSIS installer |
| Desktop (Linux) | Electron | AppImage |
| Cloud Functions | Firebase Functions | GCP Cloud Run (Gen 2) |

---

## Agent Skills Configuration

The engineering skills (from Matt Pocock's suite) read three config files to understand how indii tracks work, manages triage, and documents domain knowledge.

### Issue Tracker

**GitHub Issues** — issues live in `indii-music-founder/indii-music-founder` GitHub Issues. See `docs/agents/issue-tracker.md`.

Skills use the `gh` CLI to create, list, and manage issues. Infer repo from `git remote -v` automatically.

### Triage Labels

**Canonical five-state triage vocabulary:**

| Role | Label | Meaning |
| --- | --- | --- |
| Needs Eval | `triage/eval-needed` | Maintainer assessment required |
| Awaiting Info | `triage/awaiting-info` | Blocked waiting on reporter |
| Ready for Agent | `triage/ready-for-agent` | Fully specified, agent can pick up |
| Ready for Human | `triage/ready-for-human` | Ready for human implementation |
| Won't Fix | `wontfix` | Decided not to pursue |

See `docs/agents/triage-labels.md` for full mapping.

### Domain Context

**Single-context** — all architectural decisions and domain knowledge live in this file (canonically `CLAUDE.md`, mirrored to all agent docs). No separate ADRs. See `docs/agents/domain.md` for consumer rules.

### Skill Registries

Four skill registries exist — do not confuse them. All are active; the "not listed = deprecated" rule in `WIIL-skill.md` does NOT apply to vendored or proprietary registries.

| Registry | Contents | Edit policy |
| --- | --- | --- |
| `.agent/skills/` | Indii-authored agent skills (hunter, walk, go, tdd, zoom-out, …) | Editable — ours |
| `.agents/skills/` | Vendored third-party skills (`firebase/agent-skills` + `arcjet/skills`) pinned by root `skills-lock.json` with content hashes. Includes `firebase-security-rules-auditor` used by `/db-sync`. | **READ-ONLY** — never edit in place; update via the skills installer. The lock intentionally lists some skills that are not installed (genkit-dart, genkit-go, xcode) — do not "fix" the drift or reinstall them. |
| `skills/` | Proprietary product skills — `direct-distribution` (Direct Distribution Engine V3; pairs with `directives/direct_distribution_engine.md`) | Editable, but a covenant doc — keep status tables truthful |
| `~/.agents/skills/` | User-global skills (graphify; repo carries `.agents/workflows/graphify.md` + `.agents/rules/graphify.md`) | Machine-specific — may be absent on a given machine |


---

## Slash Workflows (`.agent/workflows/`)

These commands form the backbone of the agent's development workflow. When a user invokes one, read its corresponding markdown file in `.agent/workflows/` and execute it.

### The Core Pipeline
- `/start` — Initializes a new session, feature, or prompt. (`.agent/workflows/start.md`)
- `/proceed` — Resumes an active task and runs a compliance check. (`.agent/workflows/proceed.md`)
- `/middle` — Drives the iterative coding and building process. (`.agent/workflows/middle.md`)
- `/end` — Wraps up a session leaving a pristine repository. (`.agent/workflows/end.md`)
- `/skill-skill` — Intelligent skill router for dynamic workflows. (`.agent/workflows/skill-skill.md`)

### Utility & Verification Commands
- `/review` — Conversational Q&A loop to review state and align context. (`.agent/workflows/review.md`)
- `/opp` — Operator persona activation / handoff check. (`.agent/workflows/opp.md`)
- `/go` — Universal recursive execution loop for task continuation. (`.agent/workflows/go.md`)
- `/get-git` — Git sync, local validation, and background scheduling. (`.agent/workflows/get-git.md`)
- `/c` — Continuous coordination engine (autonomous supervisor). (`.agent/workflows/c.md`)
- `/away` — Autonomous CI monitor & merge loop. (`.agent/workflows/away.md`)
- `/ci-validate` — Pre-push CI validation and commit consolidation. (`.agent/workflows/ci-validate.md`)
- `/flowchart` — Dynamic architecture and flow visualizer using Mermaid. (`.agent/workflows/flowchart.md`)
- `/db-sync` — Security rules and schema auditor. (`.agent/workflows/db-sync.md`)
- `/auto-fix` — Auto-fix Sentry issues and CodeRabbit PR comments. (`.agent/workflows/auto-fix.md`)
- `/hunter` — Full-spectrum bug hunter. (`.agent/workflows/hunter.md`)
- `/issue-sweep` — End-to-end issue sweep and stabilization. (`.agent/workflows/issue-sweep.md`)
- `/better` — Universal improvement engine (audit, elevate, polish). (`.agent/workflows/better.md`)
- `/finish` — Unfinished work sweep (TODOs, stubs, slop). (`.agent/workflows/finish.md`)
- `/devex-review` — Developer experience (DX) audit. (`.agent/workflows/devex-review.md`)
- `/factory` — Automated test & fix loop (nightly/autonomous runs). (`.agent/workflows/factory.md`)
- `/test` — Context-aware test runner. (`.agent/workflows/test.md`)
- `/training` — AI agent dataset generation & fine-tuning. (`.agent/workflows/training.md`)
- `/api` — The API knowledge base and diagnostic tool. (`.agent/workflows/api.md`)
- `/to-prd` — Product Requirement Document (PRD) generator. (`.agent/workflows/to-prd.md`)
- `/to-issues` — vertical-Slice Ticketer. (`.agent/workflows/to-issues.md`)
- `/grill-me` — Architect Interviewer (stress-test ADRs). (`.agent/workflows/grill-me.md`)
- `/zoom-out` — Codebase dependency mapper. (`.agent/workflows/zoom-out.md`)
- `/tdd` — Test-driven development loop. (`.agent/workflows/tdd.md`)
- `/mega` — Mega stress test orchestrator. (`.agent/workflows/mega.md`)
- `/mega-test` — Single mega test plan execution. (`.agent/workflows/mega-test.md`)
- `/real` — Adaptive real-life testing workflow. (`.agent/workflows/real.md`)
- `/auto_qa` — Autonomous visual QA via browser subagent. (`.agent/workflows/auto_qa.md`)
- `/issue` — The Fix Agent (resolves issues logged in the ledger). (`.agent/workflows/issue.md`)
- Engine Swarm: `/a` (Finder), `/b` (Resolver), `/c` (Shipper), `/d` (Verifier), `/abcd` (Launch All). (`.agent/workflows/a.md`, `b.md`, `c.md`, `d.md`, `abcd.md`)

---

## Skill Routing

When a user request matches a skill pattern below, **READ the referenced skill file first and follow its instructions exactly**. Do not answer ad hoc when a skill exists — the skill provides a proven, structured workflow.

**How to invoke a skill:** Read the file at the listed path, internalize the protocol, then execute it step-by-step. Do not summarize — execute.

### Agent Skills (`.agent/skills/`)

#### Testing & QA
- `test` — Smart test runner for modified files (`.agent/skills/test/SKILL.md`)
- `auto_qa` — Visual QA, screenshot testing (`.agent/skills/auto_qa/SKILL.md`)
- `tdd` — Red-green-refactor via public interfaces (`.agent/skills/tdd/SKILL.md`)
- `health-check` — Preventative health audit (`.agent/skills/health-check/SKILL.md`)

#### Debugging & Troubleshooting
- `diagnose` — Trace root cause from logs to codebase to hypothesis to fix (`.agent/skills/diagnose/SKILL.md`)
- `hunter` — Full-spectrum bug hunt (security, leaks, races) (`.agent/skills/hunter/SKILL.md`)
- `error_memory` — **MANDATORY check before debug** (`.agent/skills/error_memory/ERROR_LEDGER.md`)

#### Code Planning & Architecture
- `agentic-harness-architect` — Design/evaluate AI agent harnesses (`.agent/skills/agentic-harness-architect/SKILL.md`)
- `zoom-out` — Map codebase callers, dependencies, structure (`.agent/skills/zoom-out/SKILL.md`)
- `grill-with-docs` — Interview plan against codebase context & ADRs (`.agent/skills/grill-with-docs/SKILL.md`)
- `to-prd` — Turn conversation into PRD (`.agent/skills/to-prd/SKILL.md`)
- `to-issues` — Break PRD/plan into vertical-slice issues (`.agent/skills/to-issues/SKILL.md`)

#### Development Productivity
- `grill-me` — Interview pattern for non-code planning (product/strategy) (`.agent/skills/grill-me/SKILL.md`)
- `caveman` — Terse mode: cut ~75% tokens (`.agent/skills/caveman/SKILL.md`)
- `walk` — Session bootstrap, drive codebase to prime (`.agent/skills/walk/SKILL.md`)
- `go` — Recursive execution loop (`.agent/skills/go/SKILL.md`)
- `skill – skill` — Dynamic skill/tool router (`.agent/skills/skill – skill/SKILL.md`)

#### Code Review & Quality
- `health_audit` — Full engineering health audit, ship readiness (`.agent/skills/health_audit/SKILL.md`)
- `hooks` — Audit, improve, add, or remove hooks (`.agent/skills/hooks/SKILL.md`)

#### Configuration & Setup
- `setup-pre-commit` — Install Husky + lint-staged + Prettier + tests (`.agent/skills/setup-pre-commit/SKILL.md`)
- `git-guardrails-claude-code` — Block dangerous git commands (`.agent/skills/git-guardrails-claude-code/SKILL.md`)

#### Creative & Media Production
- `indii-cinema-worldbuilder` — Cinematic worldbuilding (`.agent/skills/indii-cinema-worldbuilder/SKILL.md`)
- `indii-director` — AI director for cinematic sequences (`.agent/skills/indii-director/SKILL.md`)

### Jules Tools (`.jules/`)

| Trigger | Tool File |
|---------|----------|
| Access control, auth flows | `.jules/access.md` |
| Rapid task execution | `.jules/bolt.md` |
| UI component building | `.jules/bolt_ui.md` |
| Click path testing | `.jules/click.md` |
| Workflow / flow execution | `.jules/flow.md` |
| Build and forge operations | `.jules/forge.md` |
| Automation sequences, complex orchestration | `.jules/helix.md` |
| State and data persistence | `.jules/keeper.md` |
| Visual inspection, UI review | `.jules/lens.md` |
| Multi-agent orchestration | `.jules/maestro.md` |
| Design system, styling, color palette | `.jules/palette.md` |
| Pixel-level UI adjustments | `.jules/pixel.md` |
| Quick health pulse check | `.jules/pulse.md` |
| Monitoring, alerting, system sentinel | `.jules/sentinel.md` |
| Viewport, responsive design testing | `.jules/viewport.md` |

### Gemini-Native Equivalents for Claude Code Skills

When Claude would invoke a named Skill tool, use the following Gemini-native approach:

| Claude Skill | Gemini Approach |
|-------------|-----------------|
| `office-hours` | Apply extended reasoning to surface tradeoffs, risks, and a concrete recommendation |
| `investigate` | Trace root cause systematically: read logs → search codebase → form hypothesis → verify before touching code |
| `ship` | Stage changes → commit with conventional message → push branch → confirm CI green |
| `qa` | Use `.agent/skills/auto_qa/SKILL.md` for visual QA; run `npm test -- --run` for unit coverage |
| `review` | Read the full diff, check against architecture standards in this file, report issues by P0/P1/P2 severity |
| `document-release` | Update CHANGELOG, relevant module docs, and root README after shipping |
| `retro` | Summarize: what was built, what broke, root causes, and concrete next steps |
| `design-consultation` | Read `.jules/palette.md` + brand kit; provide design system recommendations grounded in existing tokens |
| `design-review` | Use `.agent/skills/auto_qa/SKILL.md` for screenshots + `.jules/lens.md` for visual inspection |
| `plan-eng-review` | Use `.agent/skills/agentic-harness-architect/SKILL.md`; apply all 12 architecture primitives |
| `checkpoint` | Write current session state to `.agent/HANDOFF_STATE.md` with completed work, decisions, and next steps |
| `health` | Use `.agent/skills/health_audit/SKILL.md` for full spectrum audit |

## Skill routing (General Principles)

When the user's request matches an available skill, ALWAYS invoke it using the Skill tool as your FIRST action. Do NOT answer directly, do NOT use other tools first. The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
