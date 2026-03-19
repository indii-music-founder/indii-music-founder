# Agent Instructions

> This file is mirrored across **CLAUDE.md**, **GEMINI.md**, **DROID.md**, **JULES.md**, and **CODEX.md** to ensure architectural consistency across all AI environments.
>
> **Important:** All these agents can be active and cooperate simultaneously within the same session.

---

## Project Overview

**indiiOS** is a multi-tenant, AI-native creative platform for independent music producers, visual artists, and creators. It provides a unified workspace combining AI-powered image generation, video production, music synthesis, distribution, and business operations.

- **Version:** 0.1.0-beta.2
- **Org:** IndiiOS LLC
- **Repo:** `the-walking-agency-det/indiiOS-Alpha-Electron`
- **Node Requirement:** >= 22.0.0

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
indiiOS-Alpha-Electron/
├── src/                        # Main React application source
│   ├── core/                   # App infrastructure (App.tsx, store, contexts, themes)
│   │   ├── App.tsx             # Main entry - lazy-loads all modules
│   │   ├── store.ts            # Zustand root store
│   │   ├── store/slices/       # Domain-specific state slices
│   │   ├── components/         # Shell UI (Sidebar, CommandBar, RightPanel, ChatOverlay)
│   │   ├── context/            # React contexts (Toast, Voice, Theme)
│   │   └── constants.ts        # Module IDs, standalone modules
│   ├── modules/                # 20+ lazy-loaded feature modules
│   │   ├── agent/              # Agent orchestration UI
│   │   ├── creative/           # AI image generation studio
│   │   ├── video/              # Video production (Veo 3.1)
│   │   ├── dashboard/          # Main dashboard
│   │   ├── distribution/       # Multi-distributor release management
│   │   ├── finance/            # Revenue tracking, royalty management
│   │   ├── legal/              # Contract review, rights management
│   │   ├── licensing/          # Licensing management
│   │   ├── marketing/          # Campaigns, brand assets, AI copywriting
│   │   ├── merchandise/        # Merchandise and POD integration
│   │   ├── publishing/         # Publishing dashboard
│   │   ├── social/             # Social media integration
│   │   ├── touring/            # Road/tour management
│   │   ├── workflow/           # Node-based automation editor
│   │   ├── knowledge/          # Knowledge base
│   │   ├── onboarding/         # Onboarding flow
│   │   └── ...                 # debug, files, history, observability, publicist, tools
│   ├── services/               # 40+ business logic services
│   │   ├── agent/              # indii Conductor orchestration
│   │   ├── ai/                 # Gemini, Vertex AI wrappers
│   │   ├── audio/              # Audio analysis (Essentia.js)
│   │   ├── ddex/               # DDEX ERN/DSR handling
│   │   ├── distribution/       # Multi-distributor facade
│   │   ├── image/              # Image generation
│   │   ├── video/              # Video processing
│   │   └── ...                 # cache, finance, identity, legal, marketing, payment, etc.
│   ├── components/             # Shared UI components
│   │   ├── ui/                 # Basic UI components (Radix-based)
│   │   ├── kokonutui/          # Custom UI kit
│   │   ├── studio/             # Studio-specific components
│   │   └── shared/             # General shared components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utility libraries
│   ├── types/                  # TypeScript type definitions
│   └── config/                 # App configuration
│
├── functions/                  # Firebase Cloud Functions (Node.js 22, Gen 2)
│   └── src/
│       ├── stripe/             # Stripe payment integration
│       ├── subscription/       # Subscription management
│       ├── analytics/          # Analytics functions
│       └── shared/             # Shared types and schemas
│
├── electron/                   # Electron desktop wrapper
│   ├── main.ts                 # Main process entry
│   └── preload.ts              # IPC bridge to renderer
│
├── agents/                     # AI agent definitions (hub-and-spoke architecture)
│   ├── agent0/                 # Hub orchestrator (indii Conductor)
│   ├── creative-director/      # Creative direction agent
│   ├── indii_executor/         # Task executor
│   └── [specialist agents]/    # brand, finance, legal, licensing, marketing,
│                               # music, publicist, publishing, road, social, video
│
├── execution/                  # Deterministic scripts for agent tools (Layer 3)
│   ├── distribution/           # DDEX generation, SFTP upload, QC validation, ISRC
│   ├── audio/                  # Audio forensics, fidelity audit
│   └── finance/                # Waterfall payout calculations
│
├── directives/                 # AI agent SOPs (Layer 1)
│
├── python/                     # Python agent tools and API handlers
│   ├── tools/                  # 20+ custom tools (image gen, video gen, audio, browser, DDEX, etc.)
│   ├── api/                    # REST API handlers
│   └── helpers/                # MCP server, task scheduler
│
├── e2e/                        # Playwright E2E tests (60+ spec files)
├── landing-page/               # Separate marketing site (React + Vite)
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
| Framework | React 18 | With lazy-loaded modules |
| Build | Vite 6.4 | Port 4242 for dev |
| Styling | TailwindCSS 4.1 | With tailwind-merge, clsx |
| State | Zustand 5.0 | Slice-based store pattern |
| Animation | Framer Motion 12.x | |
| Canvas | Fabric.js 6.9 | Image editing |
| Graph Editor | React Flow 11.11 | Workflow automation |
| Audio | Wavesurfer.js 7.11 + Essentia.js | Analysis & visualization |
| Video | Remotion 4.0 | Video rendering |
| 3D | Three.js 0.182 | Via @react-three/fiber |
| Charts | Recharts 3.6 | Data visualization |
| Router | React Router 7.11 | URL sync |
| UI Kit | Radix UI + Lucide icons | Accessible primitives |
| Validation | Zod 3.25 | Schema validation |

### Backend
| Category | Technology | Notes |
|----------|-----------|-------|
| Functions | Firebase Functions 7.0 (Gen 2) | Node.js 22 runtime |
| AI | Genkit AI 1.26 + @google/genai 1.30 | Gemini models |
| Jobs | Inngest 3.46 | Background job orchestration |
| Payments | Stripe 20.1 | Subscription billing |
| Database | Firestore | With security rules |
| Storage | Firebase Storage | With security rules |
| Analytics | BigQuery | Revenue analytics |

### Desktop (Electron 33)
| Component | Purpose |
|-----------|---------|
| Electron Forge 7.8 / Builder 26.0 | Packaging (DMG, NSIS, AppImage) |
| Keytar 7.9 | OS credential storage |
| SSH2/SFTP | Distributor file uploads |
| FFmpeg / FFProbe | Audio/video processing |

### Testing
| Tool | Purpose |
|------|---------|
| Vitest 4.0 | Unit tests (jsdom environment) |
| Playwright 1.57 | E2E tests (60+ specs) |
| Testing Library 16.3 | Component testing |
| axe-core 4.11 | Accessibility testing |

---

## Development Commands

### Daily Development
```bash
npm run dev                    # Start Vite dev server on :4242
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
import { AgentDef } from '@agents/creative-director';     // agents/*
```

### State Management (Zustand)
- Root store at `src/core/store.ts`
- Domain slices in `src/core/store/slices/`:
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
- All feature modules are **lazy-loaded** via `React.lazy()` in `src/core/App.tsx`
- Module components mapped in `MODULE_COMPONENTS` record by `ModuleId`
- Standalone modules (no chrome/sidebar) defined in `STANDALONE_MODULES`
- Each module lives in `src/modules/<name>/` with its own components, hooks, and types

### Component Organization
- Shared UI primitives in `src/components/ui/` (Radix-based)
- Module-specific components in `src/modules/<name>/components/`
- Layout components in `src/components/layout/`

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
- `VITE_VERTEX_PROJECT_ID` / `VITE_VERTEX_LOCATION` - Vertex AI config
- `VITE_GOOGLE_MAPS_API_KEY` - Google Maps
- `VITE_SKIP_ONBOARDING` - Skip onboarding in dev
- `VITE_FIREBASE_APP_CHECK_KEY` - App Check (required for production)

---

## Testing Conventions

### Unit Tests (Vitest)
- Test setup: `src/test/setup.ts` - provides centralized Firebase mocks, ResizeObserver/Canvas/matchMedia mocks
- Environment: jsdom with `@testing-library/jest-dom`
- Co-locate tests with source: `*.test.ts` / `*.test.tsx`
- Firebase services are fully mocked (auth, firestore, storage, functions, messaging, app-check, AI)
- AgentZeroService is retired (tombstone export) — mock prevents test hangs
- Run: `npm test` (watch) or `npm test -- --run` (CI)

### E2E Tests (Playwright)
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
5. Required secrets: `VITE_API_KEY`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_VERTEX_PROJECT_ID`, `VITE_VERTEX_LOCATION`, `FIREBASE_SERVICE_ACCOUNT`

### Build Pipeline (`npm run build`)
The `build` script runs three steps sequentially:
1. `npm run typecheck` - TypeScript compiler check
2. `npm run lint` - ESLint
3. `vite build` - Production bundle with terser minification (console/debugger stripped)

---

## Hub-and-Spoke Agent Architecture

```
         ┌─────────────────────┐
         │  indii Conductor (Hub) │
         │    (Orchestrator)      │
         └──────────┬──────────┘
                    │
    ┌───────────────┼───────────────┐
    │       │       │       │       │
  Legal   Brand  Marketing Music  Video
  Agent   Agent   Agent   Agent  Agent
    │
  [Finance, Publishing, Road Manager, Licensing, Social, Publicist, etc.]
```

- **indii Conductor** (`agents/agent0/`) - Central hub, routes tasks to specialists
- **Specialist Agents** - Domain experts with focused capabilities
- **AI Sidecar** - Dockerized Python runtime (`docker-compose.yml`) on `localhost:50080`
- **Python Tools** (`python/tools/`) - 20+ execution tools (image gen, video gen, audio analysis, browser automation, DDEX, payment gate, etc.)

---

## Operating Principles

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
3. **CHECK MEM0** - Query `mcp_mem0_search-memories(query="<error message>", userId="indiiOS-errors")`.
4. **APPLY FIX** - If a match is found, apply the documented solution verbatim.
5. **DOCUMENT NEW** - If this is a genuinely new error, add it to the ledger AND mem0 after solving.

**Adding to mem0:**

```javascript
mcp_mem0_add-memory(
  content="ERROR: <pattern> | FIX: <solution> | FILE: <relevant file>",
  userId="indiiOS-errors"
)
```

**Failure to check the ledger first is a protocol violation.**

---

## Key Files Quick Reference

| File | Purpose |
|------|---------|
| `src/core/App.tsx` | Main app entry, module routing, lazy loading |
| `src/core/store.ts` | Zustand root store |
| `src/core/store/slices/` | Domain state slices (app, auth, agent, creative, distribution, etc.) |
| `src/core/constants.ts` | Module IDs, standalone module list |
| `vite.config.ts` | Build config, path aliases, PWA, chunk splitting |
| `tsconfig.json` | TypeScript config (ES2022, strict, bundler resolution) |
| `eslint.config.js` | ESLint flat config with React/TS rules |
| `firebase.json` | Firebase hosting (2 targets), Firestore, Storage config |
| `firestore.rules` | Firestore security rules |
| `storage.rules` | Cloud Storage security rules |
| `electron/main.ts` | Electron main process |
| `electron/preload.ts` | Electron IPC bridge |
| `docker-compose.yml` | AI Sidecar + Ollama containers |
| `.env.example` | Environment variable template |
| `src/test/setup.ts` | Vitest global test setup and Firebase mocks |

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
