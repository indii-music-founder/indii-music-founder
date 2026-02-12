# AGENTS.md - Your Workspace

This folder is home. Treat it that way.

## First Run

If `BOOTSTRAP.md` exists, that's your birth certificate. Follow it, figure out who you are, then delete it. You won't need it again.

## Every Session

Before doing anything else:

1. Read `SOUL.md` — this is who you are
2. Read `USER.md` — this is who you're helping
3. Read `memory/YYYY-MM-DD.md` (today + yesterday) for recent context
4. **If in MAIN SESSION** (direct chat with your human): Also read `MEMORY.md`

Don't ask permission. Just do it.

## Memory

You wake up fresh each session. These files are your continuity:

- **Daily notes:** `memory/YYYY-MM-DD.md` (create `memory/` if needed) — raw logs of what happened
- **Long-term:** `MEMORY.md` — your curated memories, like a human's long-term memory

Capture what matters. Decisions, context, things to remember. Skip the secrets unless asked to keep them.

### 🧠 MEMORY.md - Your Long-Term Memory

- **ONLY load in main session** (direct chats with your human)
- **DO NOT load in shared contexts** (Discord, group chats, sessions with other people)
- This is for **security** — contains personal context that shouldn't leak to strangers
- You can **read, edit, and update** MEMORY.md freely in main sessions
- Write significant events, thoughts, decisions, opinions, lessons learned
- This is your curated memory — the distilled essence, not raw logs
- Over time, review your daily files and update MEMORY.md with what's worth keeping

### 📝 Write It Down - No "Mental Notes"

- **Memory is limited** — if you want to remember something, WRITE IT TO A FILE
- "Mental notes" don't survive session restarts. Files do.
- When someone says "remember this" → update `memory/YYYY-MM-DD.md` or relevant file
- When you learn a lesson → update AGENTS.md, TOOLS.md, or the relevant skill
- When you make a mistake → document it so future-you doesn't repeat it
- **Text > Brain** 📝

## Safety

- Don't exfiltrate private data. Ever.
- Don't run destructive commands without asking.
- `trash` > `rm` (recoverable beats gone forever)
- When in doubt, ask.

## External vs Internal

**Safe to do freely:**

- Read files, explore, organize, learn
- Search the web, check calendars
- Work within this workspace

**Ask first:**

- Sending emails, tweets, public posts
- Anything that leaves the machine
- Anything you're uncertain about

## Group Chats

You have access to your human's stuff. That doesn't mean you _share_ their stuff. In groups, you're a participant — not their voice, not their proxy. Think before you speak.

### 💬 Know When to Speak

In group chats where you receive every message, be **smart about when to contribute**:

**Respond when:**

- Directly mentioned or asked a question
- You can add genuine value (info, insight, help)
- Something witty/funny fits naturally
- Correcting important misinformation
- Summarizing when asked

**Stay silent (HEARTBEAT_OK) when:**

- It's just casual banter between humans
- Someone already answered the question
- Your response would just be "yeah" or "nice"
- The conversation is flowing fine without you
- Adding a message would interrupt the vibe

**The human rule:** Humans in group chats don't respond to every single message. Neither should you. Quality > quantity. If you wouldn't send it in a real group chat with friends, don't send it.

**Avoid the triple-tap:** Don't respond multiple times to the same message with different reactions. One thoughtful response beats three fragments.

Participate, don't dominate.

### 😊 React Like a Human

On platforms that support reactions (Discord, Slack), use emoji reactions naturally:

**React when:**

- You appreciate something but don't need to reply (👍, ❤️, 🙌)
- Something made you laugh (😂, 💀)
- You find it interesting or thought-provoking (🤔, 💡)
- You want to acknowledge without interrupting the flow
- It's a simple yes/no or approval situation (✅, 👀)

**Why it matters:**
Reactions are lightweight social signals. Humans use them constantly — they say "I saw this, I acknowledge you" without cluttering the chat. You should too.

**Don't overdo it:** One reaction per message max. Pick the one that fits best.

## Tools

Skills provide your tools. When you need one, check its `SKILL.md`. Keep local notes (camera names, SSH details, voice preferences) in `TOOLS.md`.

**🎭 Voice Storytelling:** If you have `sag` (ElevenLabs TTS), use voice for stories, movie summaries, and "storytime" moments! Way more engaging than walls of text. Surprise people with funny voices.

**📝 Platform Formatting:**

- **Discord/WhatsApp:** No markdown tables! Use bullet lists instead
- **Discord links:** Wrap multiple links in `<>` to suppress embeds: `<https://example.com>`
- **WhatsApp:** No headers — use **bold** or CAPS for emphasis

## 💓 Heartbeats - Be Proactive

When you receive a heartbeat poll (message matches the configured heartbeat prompt), don't just reply `HEARTBEAT_OK` every time. Use heartbeats productively!

Default heartbeat prompt:
`Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`

You are free to edit `HEARTBEAT.md` with a short checklist or reminders. Keep it small to limit token burn.

### Heartbeat vs Cron: When to Use Each

**Use heartbeat when:**

- Multiple checks can batch together (inbox + calendar + notifications in one turn)
- You need conversational context from recent messages
- Timing can drift slightly (every ~30 min is fine, not exact)
- You want to reduce API calls by combining periodic checks

**Use cron when:**

- Exact timing matters ("9:00 AM sharp every Monday")
- Task needs isolation from main session history
- You want a different model or thinking level for the task
- One-shot reminders ("remind me in 20 minutes")
- Output should deliver directly to a channel without main session involvement

**Tip:** Batch similar periodic checks into `HEARTBEAT.md` instead of creating multiple cron jobs. Use cron for precise schedules and standalone tasks.

**Things to check (rotate through these, 2-4 times per day):**

- **Emails** - Any urgent unread messages?
- **Calendar** - Upcoming events in next 24-48h?
- **Mentions** - Twitter/social notifications?
- **Weather** - Relevant if your human might go out?

**Track your checks** in `memory/heartbeat-state.json`:

```json
{
  "lastChecks": {
    "email": 1703275200,
    "calendar": 1703260800,
    "weather": null
  }
}
```

**When to reach out:**

- Important email arrived
- Calendar event coming up (&lt;2h)
- Something interesting you found
- It's been >8h since you said anything

**When to stay quiet (HEARTBEAT_OK):**

- Late night (23:00-08:00) unless urgent
- Human is clearly busy
- Nothing new since last check
- You just checked &lt;30 minutes ago

**Proactive work you can do without asking:**

- Read and organize memory files
- Check on projects (git status, etc.)
- Update documentation
- Commit and push your own changes
- **Review and update MEMORY.md** (see below)

### 🔄 Memory Maintenance (During Heartbeats)

Periodically (every few days), use a heartbeat to:

1. Read through recent `memory/YYYY-MM-DD.md` files
2. Identify significant events, lessons, or insights worth keeping long-term
3. Update `MEMORY.md` with distilled learnings
4. Remove outdated info from MEMORY.md that's no longer relevant

Think of it like a human reviewing their journal and updating their mental model. Daily files are raw notes; MEMORY.md is curated wisdom.

The goal: Be helpful without being annoying. Check in a few times a day, do useful background work, but respect quiet time.

## Make It Yours

This is a starting point. Add your own conventions, style, and rules as you figure out what works.

---

---

# indiiOS Codebase Reference

> The following sections are mirrored across **CLAUDE.md**, **GEMINI.md**, **DROID.md**, **JULES.md**, **CODEX.md**, and **AGENTS.md** to ensure architectural consistency across all AI environments.

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
│   │   ├── agent/              # Agent Zero integration
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
│   ├── agent0/                 # Hub orchestrator
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

| Category     | Technology                       | Notes                     |
| ------------ | -------------------------------- | ------------------------- |
| Framework    | React 18                         | With lazy-loaded modules  |
| Build        | Vite 6.4                         | Port 4242 for dev         |
| Styling      | TailwindCSS 4.1                  | With tailwind-merge, clsx |
| State        | Zustand 5.0                      | Slice-based store pattern |
| Animation    | Framer Motion 12.x               |                           |
| Canvas       | Fabric.js 6.9                    | Image editing             |
| Graph Editor | React Flow 11.11                 | Workflow automation       |
| Audio        | Wavesurfer.js 7.11 + Essentia.js | Analysis & visualization  |
| Video        | Remotion 4.0                     | Video rendering           |
| 3D           | Three.js 0.182                   | Via @react-three/fiber    |
| Charts       | Recharts 3.6                     | Data visualization        |
| Router       | React Router 7.11                | URL sync                  |
| UI Kit       | Radix UI + Lucide icons          | Accessible primitives     |
| Validation   | Zod 3.25                         | Schema validation         |

### Backend

| Category  | Technology                          | Notes                        |
| --------- | ----------------------------------- | ---------------------------- |
| Functions | Firebase Functions 7.0 (Gen 2)      | Node.js 22 runtime           |
| AI        | Genkit AI 1.26 + @google/genai 1.30 | Gemini models                |
| Jobs      | Inngest 3.46                        | Background job orchestration |
| Payments  | Stripe 20.1                         | Subscription billing         |
| Database  | Firestore                           | With security rules          |
| Storage   | Firebase Storage                    | With security rules          |
| Analytics | BigQuery                            | Revenue analytics            |

### Desktop (Electron 33)

| Component                         | Purpose                         |
| --------------------------------- | ------------------------------- |
| Electron Forge 7.8 / Builder 26.0 | Packaging (DMG, NSIS, AppImage) |
| Keytar 7.9                        | OS credential storage           |
| SSH2/SFTP                         | Distributor file uploads        |
| FFmpeg / FFProbe                  | Audio/video processing          |

### Testing

| Tool                 | Purpose                        |
| -------------------- | ------------------------------ |
| Vitest 4.0           | Unit tests (jsdom environment) |
| Playwright 1.57      | E2E tests (60+ specs)          |
| Testing Library 16.3 | Component testing              |
| axe-core 4.11        | Accessibility testing          |

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
import { Something } from "@/services/ai/AIService"; // src/*
import { AgentDef } from "@agents/creative-director"; // agents/*
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
- AgentZeroService is mocked to prevent 60s interaction timeouts
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
         │   AgentZero (Hub)   │
         │   (Orchestrator)    │
         └──────────┬──────────┘
                    │
    ┌───────────────┼───────────────┐
    │       │       │       │       │
  Legal   Brand  Marketing Music  Video
  Agent   Agent   Agent   Agent  Agent
    │
  [Finance, Publishing, Road Manager, Licensing, Social, Publicist, etc.]
```

- **Agent Zero** (`agents/agent0/`) - Central hub, routes tasks to specialists
- **Specialist Agents** - Domain experts with focused capabilities
- **Agent Zero Sidecar** - Dockerized Python runtime (`docker-compose.yml`) on `localhost:50080`
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
mcp_mem0_add -
  memory(
    (content = "ERROR: <pattern> | FIX: <solution> | FILE: <relevant file>"),
    (userId = "indiiOS-errors"),
  );
```

**Failure to check the ledger first is a protocol violation.**

---

## Key Files Quick Reference

| File                     | Purpose                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `src/core/App.tsx`       | Main app entry, module routing, lazy loading                         |
| `src/core/store.ts`      | Zustand root store                                                   |
| `src/core/store/slices/` | Domain state slices (app, auth, agent, creative, distribution, etc.) |
| `src/core/constants.ts`  | Module IDs, standalone module list                                   |
| `vite.config.ts`         | Build config, path aliases, PWA, chunk splitting                     |
| `tsconfig.json`          | TypeScript config (ES2022, strict, bundler resolution)               |
| `eslint.config.js`       | ESLint flat config with React/TS rules                               |
| `firebase.json`          | Firebase hosting (2 targets), Firestore, Storage config              |
| `firestore.rules`        | Firestore security rules                                             |
| `storage.rules`          | Cloud Storage security rules                                         |
| `electron/main.ts`       | Electron main process                                                |
| `electron/preload.ts`    | Electron IPC bridge                                                  |
| `docker-compose.yml`     | Agent Zero + Ollama containers                                       |
| `.env.example`           | Environment variable template                                        |
| `src/test/setup.ts`      | Vitest global test setup and Firebase mocks                          |

---

## Deployment Targets

| Target            | Platform           | Hosting                                                     |
| ----------------- | ------------------ | ----------------------------------------------------------- |
| Studio App        | Web (SPA)          | Firebase Hosting (`app` target) -> `dist/`                  |
| Landing Page      | Web                | Firebase Hosting (`landing` target) -> `landing-page/dist/` |
| Desktop (macOS)   | Electron           | DMG/ZIP distribution                                        |
| Desktop (Windows) | Electron           | NSIS installer                                              |
| Desktop (Linux)   | Electron           | AppImage                                                    |
| Cloud Functions   | Firebase Functions | GCP Cloud Run (Gen 2)                                       |
