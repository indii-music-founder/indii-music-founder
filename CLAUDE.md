# CLAUDE.md - AI Assistant's Guide to indiiOS

**Last Updated:** 2026-01-16
**Repository:** indiiOS-Alpha-Electron (indiiOS - The Operating System for Independent Artists)
**Version:** 0.1.0-beta.2
**Purpose:** Comprehensive guide for AI assistants to understand codebase structure, conventions, and development workflows.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Codebase Structure](#2-codebase-structure)
3. [Architecture](#3-architecture)
4. [Agent Instructions](#4-agent-instructions)
5. [Tech Stack](#5-tech-stack)
6. [Development Setup](#6-development-setup)
7. [Key Conventions & Standards](#7-key-conventions--standards)
8. [State Management](#8-state-management)
9. [Multi-Tenancy & Security](#9-multi-tenancy--security)
10. [AI & Agent System](#10-ai--agent-system)
11. [Module Reference](#11-module-reference)
12. [Electron Desktop App](#12-electron-desktop-app)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment](#14-deployment)
15. [Critical Gotchas](#15-critical-gotchas)
16. [Common Tasks](#16-common-tasks)

---

## 1. Project Overview

**indiiOS** is a multi-tenant, AI-native creative platform and operating system for independent artists. It unifies image generation, video production, music distribution, campaign management, touring, merchandise, and business operations into a single intelligent workspace.

### Core Features

- **Creative Studio:** Infinite canvas for AI image generation and editing (Fabric.js)
- **Video Studio:** AI-powered video production with Director's Cut QA (Remotion + Veo)
- **Audio Intelligence:** Audio analysis (BPM, key, energy extraction via Essentia.js)
- **Workflow Lab:** Node-based automation for chaining AI tasks (React Flow)
- **Multi-Agent System:** Specialized AI agents (Legal, Marketing, Director, Producer, Screenwriter)
- **Music Distribution:** Multi-distributor support (DistroKid, TuneCore, CD Baby, Symphonic)
- **Business Suite:** Finance, licensing, touring, merchandise, and publicist modules
- **Social Media:** Multi-platform content management and posting

### Live Deployments

- **Landing Page:** <https://indiios-v-1-1.web.app>
- **Studio App:** <https://indiios-studio.web.app>
- **Desktop App:** Electron builds for Mac, Windows, Linux

---

## 2. Codebase Structure

```
indiiOS-Alpha-Electron/
├── src/                          # Frontend source code (822+ files)
│   ├── agents/                   # Frontend AI agent implementations
│   │   ├── director/             # Video direction agent
│   │   ├── legal/                # Legal analysis agent
│   │   ├── producer/             # Music production agent
│   │   └── screenwriter/         # Content creation agent
│   ├── core/                     # Core app infrastructure
│   │   ├── App.tsx              # Main application (20+ lazy-loaded modules)
│   │   ├── store/               # Zustand store
│   │   │   ├── index.ts         # Store composition
│   │   │   └── slices/          # 10 active slices + 6 deferred
│   │   ├── components/          # Core UI (Sidebar, CommandBar, ChatOverlay)
│   │   ├── config/              # AI model configs
│   │   ├── context/             # VoiceContext, ToastContext
│   │   ├── constants.ts         # 30 module IDs
│   │   └── theme/               # Module color schemes
│   ├── modules/                  # Feature modules (22 directories)
│   │   ├── agent/               # Agent dashboard & monitoring
│   │   ├── creative/            # Creative Studio (image generation)
│   │   ├── dashboard/           # Main dashboard
│   │   ├── design/              # Design workspace
│   │   ├── distribution/        # Multi-distributor management
│   │   ├── files/               # File browser & preview
│   │   ├── finance/             # Revenue & expense tracking
│   │   ├── knowledge/           # Knowledge base/FAQs
│   │   ├── legal/               # Contract review
│   │   ├── licensing/           # License management
│   │   ├── marketing/           # Campaigns & brand management
│   │   ├── marketplace/         # Music/art marketplace
│   │   ├── merchandise/         # Merch studio with 3D preview
│   │   ├── observability/       # Analytics & monitoring
│   │   ├── onboarding/          # User onboarding flow
│   │   ├── publicist/           # Press kit & media relations
│   │   ├── publishing/          # Music distribution UI
│   │   ├── social/              # Social media management
│   │   ├── tools/               # Audio analyzer, reference manager
│   │   ├── touring/             # Tour dates, venue management
│   │   ├── video/               # Video Studio
│   │   └── workflow/            # Workflow Lab (node editor)
│   ├── services/                 # Business logic layer (36+ directories)
│   │   ├── agent/               # AgentZero orchestration
│   │   ├── ai/                  # Gemini/Vertex AI wrappers
│   │   ├── audio/               # Audio analysis (Essentia.js)
│   │   ├── blockchain/          # Web3 integration
│   │   ├── cache/               # Caching layer
│   │   ├── ddex/                # DDEX standards (ERN, DSR)
│   │   ├── design/              # Design system utilities
│   │   ├── distribution/        # Multi-distributor facade & adapters
│   │   ├── finance/             # Financial calculations
│   │   ├── image/               # Image generation service
│   │   ├── ingestion/           # Data import pipelines
│   │   ├── licensing/           # License management
│   │   ├── marketplace/         # Marketplace logic
│   │   ├── metadata/            # Golden metadata standards
│   │   ├── payment/             # Stripe integration
│   │   ├── publicist/           # Media relations
│   │   ├── publishing/          # Music publishing workflows
│   │   ├── rag/                 # Retrieval-augmented generation
│   │   ├── revenue/             # Revenue analytics
│   │   ├── security/            # Credential management (keytar)
│   │   ├── social/              # Social platform APIs
│   │   ├── storage/             # Firebase Storage abstraction
│   │   ├── subscription/        # Membership tiers
│   │   ├── touring/             # Tour management
│   │   ├── video/               # Video generation (Veo)
│   │   └── firebase.ts          # Firebase initialization
│   ├── components/               # Shared UI components
│   │   ├── ui/                  # Base shadcn components
│   │   ├── kokonutui/           # KokonutUI design system
│   │   ├── motion-primitives/   # Framer Motion components
│   │   ├── studio/              # Studio-specific UI
│   │   ├── subscription/        # Pricing/tier UI
│   │   └── instruments/         # Instrument approval modal
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utility functions
│   ├── shared/                   # Shared types & schemas
│   │   ├── schemas/             # Zod validation schemas
│   │   └── types/               # Shared TypeScript types
│   ├── styles/                   # Global CSS
│   └── test/                     # Test setup & utilities
├── functions/                    # Firebase Cloud Functions (Backend)
│   └── src/
│       ├── lib/                 # Function implementations
│       │   ├── video.ts         # Veo video generation
│       │   ├── long_form_video.ts
│       │   └── image.ts         # Image generation
│       ├── config/              # Model & rate limit configs
│       ├── stripe/              # Stripe webhook handlers
│       ├── subscription/        # Membership management
│       ├── analytics/           # Usage tracking
│       └── index.ts             # 100+ exported functions
├── electron/                     # Electron main/preload processes
│   ├── main.ts                  # Window management, IPC handlers
│   ├── preload.ts               # Context isolation bridge
│   ├── security.ts              # Security hardening
│   ├── handlers/                # IPC handlers
│   │   ├── system.ts            # System info, file access
│   │   ├── audio.ts             # Audio processing
│   │   ├── credential.ts        # Keytar integration
│   │   ├── agent.ts             # Agent IPC
│   │   └── distribution.ts      # Distro upload
│   └── utils/                   # IPC security, PKCE, validation
├── e2e/                          # Playwright E2E tests (39 test files)
├── landing-page/                 # Next.js landing site
├── docs/                         # Documentation
├── build/                        # Electron notarization, entitlements
├── extensions/                   # Firebase Storage Resize Images
├── scripts/                      # Build & utility scripts
├── RULES.md                      # Operational rules & Agent Zero protocol
├── MODEL_POLICY.md               # Strict model usage policy
└── ROADMAP.md                    # Future plans
```

### Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts (140+ deps, Node 22+) |
| `vite.config.ts` | Vite build with PWA, manual chunking, port 4242 |
| `tsconfig.json` | TypeScript config (ES2022, strict mode, @/ alias) |
| `firebase.json` | Dual hosting targets (studio + landing) |
| `firestore.rules` | Security rules for multi-tenancy |
| `electron-builder.json` | Mac/Windows/Linux packaging |
| `playwright.config.ts` | E2E with electron + chromium projects |
| `eslint.config.js` | Flat config with React hooks, TypeScript |
| `.husky/pre-commit` | Lint-staged + unit tests |
| `components.json` | Shadcn UI component config |

---

## 3. Architecture

### 3.1 Frontend/Backend Split

**Frontend (Client-Side):**

- React 19.2.0 + Vite 6.2.0
- Text/chat uses `GoogleGenerativeAI` SDK directly for low-latency
- State managed by Zustand (10 active slices)
- Firebase SDK for auth, Firestore, storage
- Electron for desktop distribution

**Backend (Cloud Functions):**

- Firebase Functions (Node.js 22, Gen 2)
- Vertex AI for image/video generation
- Agent execution runs server-side
- IAM Service Accounts (no exposed keys)
- Inngest for durable job workflows

**Rationale for Backend Migration:**

- Rate limiting management ("Thundering Herd" prevention)
- Cost & quota control per user tier
- Security (no key exposure)
- Observability (logging to BigQuery)

### 3.2 Hub-and-Spoke Agent Architecture

```
         ┌─────────────────────┐
         │   AgentZero (Hub)   │
         │   (Orchestrator)    │
         └──────────┬──────────┘
                    │
    ┌───────────────┼───────────────┐
    │       │       │       │       │
┌───▼──┐ ┌──▼───┐ ┌─▼────┐ ┌▼─────┐ ┌▼────────┐
│Legal │ │Brand │ │Market│ │Direct│ │Producer │
│Agent │ │Agent │ │Agent │ │Agent │ │  Agent  │
└──────┘ └──────┘ └──────┘ └──────┘ └─────────┘
```

**Components:**

- **Hub (AgentZero):** Triages requests, maintains context, delegates to specialists
- **Spokes (Specialists):** Domain experts extending `BaseAgent` with specialized tools
- **Registry:** `AgentRegistry` for capability lookup and delegation
- **Tools:** JSON schemas for AI function calling

**Key Files:**

- `src/services/agent/AgentZero.ts` - Orchestrator
- `src/services/agent/specialists/BaseAgent.ts` - Base class for specialists
- `src/services/agent/registry.ts` - Agent registry
- `src/services/agent/tools.ts` - Tool definitions
- `src/agents/` - Frontend agent implementations (Director, Legal, Producer, Screenwriter)

---

## 4. Agent Instructions

> This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

### The 3-Layer Architecture

#### Layer 1: Directive (What to do)

- Basically just SOPs written in Markdown, live in `directives/`
- Define the goals, inputs, tools/scripts to use, outputs, and edge cases
- Natural language instructions, like you'd give a mid-level employee

#### Layer 2: Orchestration (Decision making)

- This is you. Your job: intelligent routing.
- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings
- You're the glue between intent and execution. E.g you don't try scraping websites yourself—you read `directives/scrape_website.md` and come up with inputs/outputs and then run `execution/scrape_single_site.py`

#### Layer 3: Execution (Doing the work)

- Deterministic Python scripts in `execution/`
- Environment variables, api tokens, etc are stored in `.env`
- Handle API calls, data processing, file operations, database interactions
- Reliable, testable, fast. Use scripts instead of manual work. Commented well.

**Why this works:** if you do everything yourself, errors compound. 90% accuracy per step = 59% success over 5 steps. The solution is push complexity into deterministic code. That way you just focus on decision-making.

### Operating Principles

**1. Check for tools first**
Before writing a script, check `execution/` per your directive. Only create new scripts if none exist.

**2. Self-anneal when things break**

- Read error message and stack trace
- Fix the script and test it again (unless it uses paid tokens/credits/etc—in which case you check w user first)

---

## 5. Tech Stack

### Frontend

| Category | Technology | Version |
|----------|------------|---------|
| Framework | React | 19.2.0 |
| Build | Vite | 6.2.0 |
| Styling | TailwindCSS | 4.1.17 (CSS-first) |
| State | Zustand | 5.0.8 |
| Animation | Framer Motion | 12.23.26 |
| 3D/Canvas | Fabric.js | 6.9.0 |
| 3D Rendering | React Three Fiber | 9.5.0 |
| Audio | Tone.js | 15.1.22 |
| Audio Analysis | Essentia.js | 0.1.3 |
| Audio Visual | Wavesurfer.js | 7.11.1 |
| Video | Remotion | 4.0.382 |
| Workflow | React Flow | 11.11.4 |
| Charts | Recharts | 3.6.0 |
| Icons | Lucide React | 0.555.0 |
| Markdown | React Markdown | 10.1.0 |
| Validation | Zod | 3.25.76 |

### Backend

| Category | Technology | Version |
|----------|------------|---------|
| Platform | Firebase | 12.7.0 |
| Runtime | Node.js | 22+ |
| AI SDK | @google/genai | 1.30.0 |
| AI SDK | @google/generative-ai | 0.24.1 |
| Orchestration | Genkit | 1.26.0 |
| Jobs | Inngest | 3.46.0 |
| Payments | Stripe | 20.1.2 |
| Analytics | BigQuery | 8.1.1 |

### Desktop (Electron)

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Electron | Latest |
| Builder | electron-builder | Latest |
| Credentials | Keytar | 7.9.0 |
| Storage | electron-store | 11.0.2 |
| Media | FFmpeg/FFprobe | Static bundled |

### AI Models (STRICT POLICY - See MODEL_POLICY.md)

| Purpose | Constant | Model ID |
|---------|----------|----------|
| Complex reasoning | `AI_MODELS.TEXT.AGENT` | `gemini-3-pro-preview` |
| Fast tasks | `AI_MODELS.TEXT.FAST` | `gemini-3-flash-preview` |
| Image generation | `AI_MODELS.IMAGE.GENERATION` | `gemini-3-pro-image-preview` |
| Video generation | `AI_MODELS.VIDEO.GENERATION` | `veo-3.1-generate-preview` |

**Forbidden Models (WILL CRASH APP):**
- `gemini-1.5-flash`, `gemini-1.5-pro` (ALL 1.5 variants BANNED)
- `gemini-2.0-flash`, `gemini-2.0-pro` (ALL 2.0 variants BANNED)
- `gemini-pro`, `gemini-pro-vision` (legacy BANNED)

### Testing

| Category | Technology | Version |
|----------|------------|---------|
| Unit | Vitest | 4.0.15 |
| E2E | Playwright | 1.57.0 |
| Environment | jsdom, fake-indexeddb | Latest |

---

## 6. Development Setup

### Prerequisites

- **Node.js 22.0.0+** (strictly required)
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

```bash
# Clone and install
git clone <repo-url>
cd indiiOS-Alpha-Electron
npm install

# Environment setup
cp .env.example .env
# Edit .env with your keys:
# - VITE_GEMINI_API_KEY
# - VITE_FIREBASE_CONFIG (JSON string)
# - VITE_VERTEX_PROJECT_ID
# - VITE_VERTEX_LOCATION
```

### Development Commands

```bash
# Frontend development (port 4242)
npm run dev                    # Start Vite dev server

# Building
npm run build                  # Build with typecheck + lint
npm run build:studio           # Build studio app only
npm run build:landing          # Build landing page
npm run build:all              # Build both

# Testing
npm run test                   # Run Vitest unit tests
npm run test:e2e               # Run Playwright E2E tests

# Linting
npm run lint                   # Run ESLint
npm run lint:fix               # Run ESLint with auto-fix

# Electron (Desktop App)
npm run electron:dev           # Development mode (requires dev server on 4242)
npm run electron:build         # Production build
npm run build:desktop          # Full desktop release (all platforms)
npm run build:desktop:mac      # Mac only
npm run build:desktop:win      # Windows only
npm run build:desktop:linux    # Linux only

# Preview
npm run preview                # Preview production build
```

### Firebase Functions Development

```bash
cd functions
npm install
npm run build                  # Compile TypeScript
firebase emulators:start       # Run local emulators
```

---

## 7. Key Conventions & Standards

### 7.1 The Agent Zero Evolution Protocol (from RULES.md)

**Critical:** This system emulates Agent Zero framework with two internal modes:

**Mode A: Curriculum Agent (The Manager)**

- Strategy, challenge, and planning
- Generate "Frontier Tasks" that push the user forward
- Output signature: `[Curriculum]: Based on your current trajectory...`

**Mode B: Executor Agent (The Worker)**

- Tool use, coding, implementation
- Must verify every step (run code, browse trends)
- Output signature: `[Executor]: Deploying tools to solve this task...`

**Symbiotic Loop:**

- Explicitly link success to user's data
- Example: "My previous marketing strategy failed to hit 1k streams. I've updated my curriculum to prioritize TikTok."

### 7.2 Design Currency (2025/2026 Standards)

**From RULES.md:**

- **Framework:** Tailwind CSS v4 (CSS-first config) exclusively
- **Typography:** Variable fonts only (Inter, Geist)
- **Aesthetic:** "Liquid Logic" - glassmorphism, subtle borders (`border-white/5`), organic 3D shapes
- **Linting:** Run `npx eslint . --fix` before every code submission

### 7.3 Code Style

**TypeScript:**

- Strict mode enabled
- ES2022 target
- Use `@/` alias for imports (e.g., `import { useStore } from '@/core/store'`)
- No unused parameters/locals enforcement (disabled in tsconfig)

**React:**

- Functional components only
- Hooks for state/effects
- Prop types via TypeScript interfaces
- Lazy loading for modules (`const Module = lazy(() => import(...))`)

**File Naming:**

- Components: PascalCase (e.g., `CreativeStudio.tsx`)
- Services: PascalCase (e.g., `AgentService.ts`)
- Utilities: camelCase (e.g., `validationUtils.ts`)
- Tests: `*.test.ts` or `*.test.tsx` or `__tests__/` directory

### 7.4 Model Usage Policy (CRITICAL)

> **WARNING: Runtime validation is enabled. Using forbidden models will CRASH the app on startup.**

```typescript
// ✅ CORRECT - Import from central config
import { AI_MODELS } from '@/core/config/ai-models';

const response = await AI.generateContent({
  model: AI_MODELS.TEXT.AGENT,  // gemini-3-pro-preview
  contents: [...]
});

// ❌ FORBIDDEN - Hardcoded legacy models (WILL CRASH APP)
const response = await AI.generateContent({
  model: 'gemini-1.5-flash'  // APP WILL NOT START
});
```

---

## 8. State Management

### 8.1 Zustand Store Architecture

**Central Store:** `src/core/store/index.ts`

```typescript
export interface StoreState extends
    AppSlice,
    ProfileSlice,
    AgentSlice,
    CreativeSlice,
    WorkflowSlice,
    AuthSlice,
    FinanceSlice,
    DistributionSlice,
    FileSystemSlice,
    AudioIntelligenceSlice { }

export const useStore = create<StoreState>()((...a) => ({
    ...createAppSlice(...a),
    ...createProfileSlice(...a),
    // ... other slices
}));
```

### 8.2 Active Slices (10)

| Slice | File | Responsibilities |
|-------|------|------------------|
| `AppSlice` | `appSlice.ts` | Active module, sidebar, theme, toasts |
| `AuthSlice` | `authSlice.ts` | User, organizations, active org/project |
| `ProfileSlice` | `profileSlice.ts` | User profile, preferences, metadata |
| `AgentSlice` | `agentSlice.ts` | Chat messages, agent thoughts, responses |
| `CreativeSlice` | `creativeSlice.ts` | Canvas images, history, generations |
| `WorkflowSlice` | `workflowSlice.ts` | Workflow nodes, edges, execution |
| `FinanceSlice` | `financeSlice.ts` | Revenue, expenses, financial data |
| `DistributionSlice` | `distributionSlice.ts` | Release status, distributor connections |
| `FileSystemSlice` | `fileSystemSlice.ts` | File hierarchy, uploads, downloads |
| `AudioIntelligenceSlice` | `audioIntelligenceSlice.ts` | Audio analysis results (BPM, key, energy) |

### 8.3 Deferred Slices (6, commented out)

- `DashboardSlice` - Dashboard widgets
- `OnboardingSlice` - Onboarding state
- `MusicSlice` - Music library
- `LicensingSlice` - License management
- `ShowroomSlice` - 3D showroom state

### 8.4 Usage Pattern

```typescript
import { useStore } from '@/core/store';

function MyComponent() {
  // Select only needed state (prevents unnecessary re-renders)
  const activeModule = useStore((state) => state.activeModule);
  const setActiveModule = useStore((state) => state.setActiveModule);

  // Or destructure multiple
  const { user, activeOrg } = useStore((state) => ({
    user: state.user,
    activeOrg: state.activeOrg
  }));
}
```

### 8.5 Store Debugging

```javascript
// Store is exposed globally in dev mode for debugging
window.useStore.getState();        // Get full state
window.useStore.setState({...});   // Update state (use cautiously)
```

---

## 9. Multi-Tenancy & Security

### 9.1 Data Isolation Model

**Hierarchy:**

```
User
└── Organizations (workspaces)
    └── Projects
        ├── Assets (images, videos)
        ├── History (generations)
        └── Context (brand kits, prompts)
```

**Key Principle:** All data is scoped to `{ orgId, projectId }` tuple.

### 9.2 Firestore Security Rules

```javascript
// Organizations: User must be in members array
allow read: if request.auth.uid in resource.data.members;

// Projects: User must be org member
allow read: if isOrgMember(resource.data.orgId);

function isOrgMember(orgId) {
  return request.auth.uid in get(/databases/$(database)/documents/organizations/$(orgId)).data.members;
}
```

### 9.3 Security Architecture

**Frontend Security:**
- API key environment variables (VITE_* prefix)
- Firebase Security Rules for multi-tenancy
- Credential storage via Keytar (Electron)

**Backend Security:**
- Admin claim enforcement on sensitive functions
- Origin-based CORS (whitelist: studio.indiios.com, localhost in dev)
- Rate limiting via Inngest
- App Check for mobile/desktop app verification

**Electron Security:**
- Context isolation enabled
- Sandbox enabled
- No node integration
- IPC security validation
- PKCE for OAuth flows

---

## 10. AI & Agent System (Hub-and-Spoke Architecture)

### 10.1 Architecture Overview

```
                    ┌──────────────────────────────────┐
                    │     GeneralistAgent (Hub)        │
                    │        "Agent Zero"              │
                    │   ─────────────────────────      │
                    │   Mode A: Curriculum (Manager)   │
                    │   Mode B: Executor (Worker)      │
                    │   Mode C: Companion (Chat)       │
                    └───────────────┬──────────────────┘
                                    │ delegate_task
         ┌──────────────────────────┼──────────────────────────┐
         │          │          │    │    │          │          │
    ┌────▼───┐ ┌────▼───┐ ┌───▼──┐ │ ┌──▼───┐ ┌────▼───┐ ┌────▼────┐
    │Marketing│ │ Legal  │ │Finance│ │ │Brand │ │Social  │ │Publicist│
    └────────┘ └────────┘ └──────┘ │ └──────┘ └────────┘ └─────────┘
         │          │          │    │    │          │          │
    ┌────▼───┐ ┌────▼───┐ ┌───▼──┐ │ ┌──▼───┐ ┌────▼───┐ ┌────▼────┐
    │Producer│ │Director│ │Screen│ │ │Video │ │  Road  │ │Publishing│
    │        │ │        │ │writer│ │ │      │ │Manager │ │         │
    └────────┘ └────────┘ └──────┘ │ └──────┘ └────────┘ └─────────┘
         │          │          │    │    │          │
    ┌────▼───┐ ┌────▼───┐ ┌───▼────┐│ ┌──▼───┐ ┌────▼───┐
    │Licensing│ │Merchan-│ │Security││ │DevOps│ │  ...   │
    │        │ │  dise  │ │        ││ │      │ │        │
    └────────┘ └────────┘ └────────┘│ └──────┘ └────────┘
```

### 10.2 Valid Agent IDs (17 Agents)

**Single Source of Truth:** `src/services/agent/types.ts` → `VALID_AGENT_IDS`

| Agent ID | Name | Category | Purpose |
|----------|------|----------|---------|
| `generalist` | Agent Zero | manager | Hub orchestrator, fallback, complex reasoning |
| `marketing` | Marketing Agent | department | Campaign strategy, audience targeting |
| `legal` | Legal Agent | specialist | Contract analysis, IP clause extraction |
| `finance` | Finance Agent | specialist | Revenue tracking, expense analysis |
| `producer` | Producer Agent | specialist | Music production, arrangement advice |
| `director` | Director Agent | specialist | Video production, shot selection |
| `screenwriter` | Screenwriter Agent | specialist | Script generation, content creation |
| `video` | Video Agent | specialist | Video editing, effects, rendering |
| `social` | Social Agent | specialist | Social media posting, engagement |
| `publicist` | Publicist Agent | specialist | Press releases, media relations |
| `road` | Road Manager Agent | specialist | Tour dates, venue management |
| `publishing` | Publishing Agent | specialist | Music distribution, royalties |
| `licensing` | Licensing Agent | specialist | Sync licensing, rights management |
| `brand` | Brand Agent | specialist | Brand consistency, style guides |
| `devops` | DevOps Agent | specialist | Infrastructure, deployment |
| `security` | Security Agent | specialist | Security audits, vulnerability checks |
| `merchandise` | Merchandise Agent | specialist | Product design, mockups, manufacturing |

### 10.3 Agent Sources

**Frontend Agent Configs** (`src/agents/`):
- `director/config.ts` - Director agent configuration
- `legal/config.ts` - Legal agent configuration
- `producer/config.ts` - Producer agent configuration
- `screenwriter/config.ts` - Screenwriter agent configuration

**Service Agent Definitions** (`src/services/agent/definitions/`):
- `MarketingAgent.ts`, `FinanceAgent.ts`, `BrandAgent.ts`
- `VideoAgent.ts`, `SocialAgent.ts`, `PublicistAgent.ts`
- `RoadAgent.ts`, `PublishingAgent.ts`, `LicensingAgent.ts`
- `DevOpsAgent.ts`, `SecurityAgent.ts`

**Standalone Agents** (`src/services/agent/`):
- `MerchandiseAgent.ts` - Full merchandise creation workflow
- `specialists/GeneralistAgent.ts` - Agent Zero (hub)

### 10.4 Agent Zero Protocol (3 Modes)

```typescript
// src/services/agent/specialists/GeneralistAgent.ts

// Mode A: Curriculum Agent (The Manager)
// - Strategic planning for complex goals
// - Generates "Frontier Tasks" to push user forward
// - Output: "[Curriculum]: Based on your current trajectory..."

// Mode B: Executor Agent (The Worker)
// - Tool use, coding, implementation
// - Ruthless execution with available tools
// - Output: "[Executor]: Deploying tools to solve this task..."

// Mode C: Companion (Casual Conversation)
// - Chat, greetings, simple Q&A
// - Natural responses without prefixes
```

### 10.5 Key Agent Services

| Service | File | Purpose |
|---------|------|---------|
| `AgentService` | `AgentService.ts` | Main entry point for agent interactions |
| `BaseAgent` | `BaseAgent.ts` | Base class all agents extend |
| `AgentRegistry` | `registry.ts` | Lazy-loading agent registry |
| `MemoryService` | `MemoryService.ts` | Long-term memory storage/recall |
| `ProactiveService` | `ProactiveService.ts` | Scheduled & event-triggered tasks |
| `SessionService` | `SessionService.ts` | Session management |
| `WorkflowCoordinator` | `WorkflowCoordinator.ts` | Multi-agent workflow coordination |
| `AgentContextBridge` | `AgentContextBridge.ts` | Context injection (org, project, brand) |
| `InstrumentAgentService` | `InstrumentAgentService.ts` | Tool approval workflows |
| `BrowserAgentDriver` | `BrowserAgentDriver.ts` | Browser automation capabilities |

### 10.6 Agent Lifecycle

**1. User sends message → AgentService**

```typescript
// src/services/agent/AgentService.ts
async chat(message: string) {
  const response = await agentZero.execute(message, context);
}
```

**2. Agent Zero determines mode and potentially delegates**

```typescript
// GeneralistAgent uses delegate_task tool
{
  agent_id: 'legal',  // Must be in VALID_AGENT_IDS
  task: 'Review this contract for IP clauses',
  context: { /* relevant context */ }
}
```

**3. Specialist executes with domain-specific tools**

**4. Result flows back through Agent Zero to user**

### 10.7 Adding a New Specialist Agent

**Step 1:** Add agent ID to `VALID_AGENT_IDS` in `types.ts`

**Step 2:** Create agent config in `definitions/` or `src/agents/`

```typescript
// src/services/agent/definitions/MyAgent.ts
import { AgentConfig } from '../types';

export const MyAgent: AgentConfig = {
  id: 'my-agent',
  name: 'My Agent',
  description: 'Expert in...',
  color: '#hex',
  category: 'specialist',
  systemPrompt: 'You are an expert in...',
  tools: [{ functionDeclarations: [...] }],
  functions: { my_tool: async (args) => ({ success: true, data: ... }) }
};
```

**Step 3:** Add to `AGENT_CONFIGS` array in `agentConfig.ts`

**Step 4:** Update `delegate_task` tool description if needed

### 10.8 Tool Calling Standard

**Critical:** Google AI SDK exposes text via **method** `response.text()`, NOT property.

```typescript
// ✅ CORRECT
const text = response.text(); // Method call

// ❌ WRONG (returns undefined)
const text = response.text; // Property access
```

**Tool Result Standard:**

```typescript
interface ToolFunctionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}
```

### 10.9 Tool Registry (50+ Tools)

**Location:** `src/services/agent/tools/` and `src/services/agent/tools.ts`

| Tool File | Domain | Key Functions |
|-----------|--------|---------------|
| `CoreTools.ts` | Core | `set_mode`, `update_prompt`, `read_history` |
| `DirectorTools.ts` | Video Direction | Shot planning, scene analysis |
| `VideoTools.ts` | Video | `generate_video`, `extend_video`, `update_keyframe` |
| `MemoryTools.ts` | Memory | `save_memory`, `recall_memories` |
| `AnalysisTools.ts` | Analysis | `analyze_audio`, `verify_output` |
| `FinanceTools.ts` | Finance | Budget tracking, revenue analysis |
| `SocialTools.ts` | Social | `generate_social_post` |
| `OrganizationTools.ts` | Org Mgmt | `list_organizations`, `switch_organization` |
| `StorageTools.ts` | Files | `list_files`, `search_files` |
| `KnowledgeTools.ts` | Knowledge | `search_knowledge` |
| `ProjectTools.ts` | Projects | `create_project`, `open_project` |
| `NavigationTools.ts` | Navigation | Module switching |
| `MapsTools.ts` | Maps | `search_places`, `get_place_details`, `get_distance_matrix` |
| `BrandTools.ts` | Brand | `analyze_brand_consistency`, `generate_brand_guidelines` |
| `MarketingTools.ts` | Marketing | `create_campaign_brief`, `analyze_audience`, `track_performance` |
| `RoadTools.ts` | Touring | `plan_tour_route`, `calculate_tour_budget`, `generate_itinerary` |
| `SecurityTools.ts` | Security | `audit_permissions`, `scan_for_vulnerabilities`, `rotate_credentials` |
| `DevOpsTools.ts` | DevOps | `check_api_status`, `verify_zero_touch_prod` |
| `PublicistTools.ts` | PR | `write_press_release`, `generate_crisis_response` |
| `LegalTools.ts` | Legal | `analyze_contract` |
| `BigQueryTools.ts` | Analytics | BigQuery integrations |
| `NarrativeTools.ts` | Narrative | Story/content generation |
| `ProducerTools.ts` | Music | Production advice |
| `ScreenwriterTools.ts` | Scripts | Script generation |

### 10.10 Agent Observability

**Location:** `src/services/agent/observability/`

| Service | Purpose |
|---------|---------|
| `TraceService.ts` | Execution tracing, stores to `agent_traces` collection |
| `MetricsService.ts` | Performance metrics, latency tracking |

**TraceService Features:**
- Start/complete execution traces
- Track individual steps within traces
- Calculate usage metrics and costs
- Support for swarm (multi-agent) tracing

### 10.11 Agent Evolution System (Helix)

**Location:** `src/services/agent/evolution/`

The evolution system implements genetic algorithms for agent improvement:

| Component | Purpose |
|-----------|---------|
| `EvolutionEngine.ts` | Core genetic algorithm (selection, crossover, mutation) |
| `types.ts` | `AgentGene`, `EvolutionConfig`, fitness/mutation functions |

**Helix Safety Features:**
- **Doomsday Switch:** Halts evolution at max generations
- **Fitness Validator:** 0.0 fitness kills agent (no reproduction)
- **Anti-Inbreeding:** Prevents self-crossover
- **Bloat Prevention:** Controls gene complexity
- **Gene Loss Protection:** Maintains genetic diversity

### 10.12 AI Services Layer

**Location:** `src/services/ai/`

| Service | Purpose |
|---------|---------|
| `AIService.ts` | Main AI service wrapper |
| `FirebaseAIService.ts` | Firebase-backed AI with caching |
| `AIResponseCache.ts` | Response caching layer |
| `RateLimiter.ts` | Rate limiting for API calls |
| `VoiceService.ts` | Voice/speech services |
| `OCRService.ts` | Optical character recognition (Tesseract.js) |

**Subdirectories:**
- `billing/` - Usage billing
- `config/` - AI configuration
- `context/` - Context management

---

## 11. Module Reference

### 11.1 Creative Studio (`src/modules/creative/`)

**Purpose:** AI image generation, infinite canvas, product showroom

**Key Components:**
- `CreativeStudio.tsx` - Main container
- `InfiniteCanvas.tsx` - Fabric.js canvas with pan/zoom
- `PromptBuilder.tsx` - AI-powered prompt construction

**Services:** `ImageGenerationService.ts`

### 11.2 Video Studio (`src/modules/video/`)

**Purpose:** AI video production workflow (Idea → Brief → Review)

**Key Components:**
- `VideoStudio.tsx` - Main container
- `VideoEditor.tsx` - Timeline editor
- `VideoPlayer.tsx` - Remotion Player wrapper

**Services:** `VideoGenerationService.ts` (Vertex AI Veo)

### 11.3 Workflow Lab (`src/modules/workflow/`)

**Purpose:** Node-based automation for chaining AI tasks

**Key Components:**
- `WorkflowLab.tsx` - React Flow editor
- `WorkflowEngine.ts` - Execution engine
- `nodeRegistry.ts` - Available node types

### 11.4 Marketing (`src/modules/marketing/`)

**Purpose:** Campaign management, brand assets, copywriting

**Key Components:**
- `BrandManager.tsx` - Brand kit editor
- `CampaignManager.tsx` - Campaign lifecycle

### 11.5 Distribution (`src/modules/distribution/`)

**Purpose:** Multi-distributor music distribution

**Services (`src/services/distribution/`):**
- `DistributorService.ts` - Main facade
- `adapters/DistroKidAdapter.ts`
- `adapters/TuneCoreAdapter.ts`
- `adapters/CDBabyAdapter.ts`
- `adapters/SymphonicAdapter.ts`

### 11.6 Finance (`src/modules/finance/`)

**Purpose:** Revenue tracking, expense management, financial analytics

### 11.7 Touring (`src/modules/touring/`)

**Purpose:** Tour dates, venue management, road manager features

### 11.8 Merchandise (`src/modules/merchandise/`)

**Purpose:** Merch studio with 3D product preview

### 11.9 Social (`src/modules/social/`)

**Purpose:** Multi-platform social media management and posting

### 11.10 Other Modules

| Module | Purpose |
|--------|---------|
| `agent/` | Agent dashboard & monitoring |
| `dashboard/` | Main dashboard hub |
| `design/` | Design workspace |
| `files/` | File browser & preview |
| `knowledge/` | Knowledge base/FAQs |
| `legal/` | Contract review |
| `licensing/` | License management |
| `marketplace/` | Music/art marketplace |
| `observability/` | Analytics & monitoring |
| `onboarding/` | User onboarding flow |
| `publicist/` | Press kit & media relations |
| `publishing/` | Music distribution UI |
| `tools/` | Audio analyzer, reference manager |

### 11.11 Core Services (`src/services/`)

**Business Logic Services:**

| Service | File | Purpose |
|---------|------|---------|
| `MembershipService` | `MembershipService.ts` | Subscription tiers, quotas, circuit breakers |
| `RevenueService` | `RevenueService.ts` | Revenue tracking, royalty calculations |
| `OrganizationService` | `OrganizationService.ts` | Multi-tenant organization management |
| `ProjectService` | `ProjectService.ts` | Project CRUD operations |
| `UserService` | `UserService.ts` | User profile management |
| `CleanupService` | `CleanupService.ts` | Resource cleanup, garbage collection |
| `ExportService` | `ExportService.ts` | Data export (PDF, ZIP, etc.) |
| `WhiskService` | `WhiskService.ts` | Whisk image styling integration |

**Storage Services:**

| Service | File | Purpose |
|---------|------|---------|
| `StorageService` | `StorageService.ts` | Firebase Storage abstraction |
| `CloudStorageService` | `CloudStorageService.ts` | Cloud storage operations |
| `FileSystemService` | `FileSystemService.ts` | Virtual file system |
| `NativeFileSystemService` | `NativeFileSystemService.ts` | Native FS access (Electron) |
| `FirestoreService` | `FirestoreService.ts` | Firestore abstraction |

**Domain Service Directories (36+):**

| Directory | Purpose |
|-----------|---------|
| `agent/` | Agent system (covered in Section 10) |
| `ai/` | AI services (AIService, FirebaseAI, caching) |
| `audio/` | Audio analysis (Essentia.js integration) |
| `blockchain/` | Web3/blockchain integration |
| `cache/` | Caching layer |
| `dashboard/` | Dashboard data services |
| `ddex/` | DDEX standards (ERN, DSR parsing) |
| `design/` | Design system utilities |
| `distribution/` | Multi-distributor facade + adapters |
| `finance/` | Financial calculations |
| `identity/` | Identity verification |
| `image/` | Image generation services |
| `ingestion/` | Data import pipelines |
| `knowledge/` | Knowledge base services |
| `legal/` | Legal document services |
| `licensing/` | License management |
| `marketing/` | Marketing campaign services |
| `marketplace/` | Marketplace logic |
| `merchandise/` | Merchandise services |
| `metadata/` | Golden metadata standards |
| `onboarding/` | Onboarding flow services |
| `optimistic/` | Optimistic UI updates |
| `payment/` | Stripe integration |
| `publicist/` | PR/media relations |
| `rag/` | Retrieval-augmented generation |
| `revenue/` | Revenue analytics |
| `screen/` | Screen capture/sharing |
| `scripts/` | Utility scripts |
| `security/` | Credential management (Keytar) |
| `social/` | Social platform APIs |
| `storage/` | Storage abstractions |
| `subscription/` | Membership tier management |
| `touring/` | Tour management |
| `utils/` | Shared utilities |
| `video/` | Video generation (Veo) |

---

## 12. Electron Desktop App

### 12.1 Architecture

**Main Process (`electron/main.ts`):**
- BrowserWindow management (1280x800 default)
- IPC handler registration
- Security hardening configuration

**Preload Bridge (`electron/preload.ts`):**
- Context-isolated IPC exposure
- Selective API surface for renderer

**IPC Handlers (`electron/handlers/`):**

| Handler | Purpose |
|---------|---------|
| `system.ts` | System info, file access |
| `audio.ts` | Audio processing |
| `credential.ts` | Keytar integration |
| `agent.ts` | Agent IPC |
| `distribution.ts` | Distro upload |

### 12.2 Security Configuration

```typescript
// electron/main.ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,    // Enabled
    sandbox: true,              // Enabled
    nodeIntegration: false,     // Disabled
    webviewTag: false,          // Disabled
    preload: path.join(__dirname, 'preload.cjs')
  }
});
```

### 12.3 Build Targets

| Platform | Format | Command |
|----------|--------|---------|
| Mac | DMG + ZIP | `npm run build:desktop:mac` |
| Windows | NSIS | `npm run build:desktop:win` |
| Linux | AppImage | `npm run build:desktop:linux` |
| All | All formats | `npm run build:desktop` |

### 12.4 Deep Linking

Auth protocol: `indii-os://` for OAuth callbacks

---

## 13. Testing Strategy

### 13.1 Unit Tests (Vitest)

**Location:** Co-located with source (`.test.ts` suffix) or `__tests__/` directory

**Setup:** `src/test/setup.ts`
- Mocks Firebase SDK (auth, Firestore, storage, functions)
- HTMLCanvasElement mock for jsdom
- Provides `fake-indexeddb`

**Running:**

```bash
npm run test              # All tests
npm run test -- --ui      # Visual UI
npm run test -- MyComponent  # Specific file
```

### 13.2 E2E Tests (Playwright)

**Location:** `e2e/` directory (39 test files)

**Key Tests:**
- `electron.spec.ts` - Desktop app flows
- `auth-flow.spec.ts` - Authentication
- `creative-persistence.spec.ts` - Canvas saving
- `hub-spoke.spec.ts` - Agent system
- `maestro-campaign-workflow.spec.ts` - Marketing campaigns
- `audio_intelligence_ui.spec.ts` - Audio analysis
- `stress-test.spec.ts` - Load testing
- `chaos-monkey.spec.ts` - Stability testing

**Projects:**
- Electron: Sequential execution
- Web: Chromium on localhost:4242

**Running:**

```bash
npm run test:e2e                    # Headless
npx playwright test --ui            # Interactive
npx playwright test --debug         # Debug mode
```

### 13.3 Coverage Expectations

- **Critical Paths:** AgentService, Specialists, Store slices
- **UI Components:** Snapshot tests for complex components
- **Services:** Mock external APIs (Firebase, Vertex AI)

---

## 14. Deployment

### 14.1 Hosting Architecture

**Firebase Hosting with multiple targets:**

| Target | Site ID | Directory | URL |
|--------|---------|-----------|-----|
| Landing | `indiios-v-1-1` | `landing-page/dist` | <https://indiios-v-1-1.web.app> |
| Studio | `indiios-studio` | `dist` | <https://indiios-studio.web.app> |

### 14.2 GitHub Actions Workflow

**File:** `.github/workflows/deploy.yml`

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Secrets Required:**
- `VITE_API_KEY`
- `VITE_VERTEX_PROJECT_ID`
- `VITE_VERTEX_LOCATION`
- `FIREBASE_SERVICE_ACCOUNT`

### 14.3 Manual Deployment

```bash
# Build all
npm run build:all

# Deploy hosting only
firebase deploy --only hosting

# Deploy functions + hosting
firebase deploy

# Deploy specific function
firebase deploy --only functions:generateImage

# Deploy studio app
npm run deploy
```

### 14.4 Environment Variables

**Required for Build:**

```bash
VITE_API_KEY=<gemini-api-key>
VITE_FIREBASE_CONFIG=<firebase-config-json>
VITE_VERTEX_PROJECT_ID=<gcp-project-id>
VITE_VERTEX_LOCATION=<vertex-location>
```

**Firebase Functions:**

```bash
# functions/.env
GEMINI_API_KEY=<key>
VERTEX_PROJECT_ID=<id>
```

---

## 15. Critical Gotchas

### 15.1 Google AI SDK Response Handling

```typescript
// ❌ WRONG - Returns undefined
const text = response.text;

// ✅ CORRECT
const text = response.text();
```

### 15.2 Agent Tool Hallucinations

**Problem:** Orchestrator can hallucinate agent names.

**Fix:** Strictly type `agent_id` and list valid IDs in tool description.

### 15.3 Firestore Query Constraints

**Problem:** Compound queries require composite indexes.

**Fix:** Run query in dev, copy index creation link from error, add to `firestore.indexes.json`.

### 15.4 Vite Build Chunk Size Warnings

**Fix:** Manual chunks configured in `vite.config.ts`:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'framer-motion'],
  'vendor-firebase': ['firebase/app', 'firebase/auth', ...],
}
```

### 15.5 Tailwind v4 Migration

**Fix:** Use CSS variables for theming, import Tailwind in `index.css`:

```css
@import 'tailwindcss';
```

### 15.6 Firebase Functions Cold Starts

**Mitigation:**
- Use Gen 2 functions (faster cold starts)
- Implement request queueing with Inngest

### 15.7 Electron Forge Build Fails with Spaced Paths

**Problem:** node-gyp fails with paths containing spaces.

**Fix:** Configure `rebuildConfig` in `forge.config.cjs`:

```javascript
rebuildConfig: {
  onlyModules: []  // Skip native module rebuilds
},
```

### 15.8 Dev Server Port

**Important:** Development server runs on port **4242**, not 5173.

```bash
npm run dev  # Starts on http://localhost:4242
```

---

## 16. Common Tasks

### 16.1 Add a New Module

```bash
mkdir -p src/modules/my-module
touch src/modules/my-module/{MyModule.tsx,README.md}
```

1. Create component in `MyModule.tsx`
2. Add lazy import in `App.tsx`
3. Add to sidebar navigation in `Sidebar.tsx`
4. Update module constants in `core/constants.ts`

### 16.2 Add a Cloud Function

```typescript
// functions/src/myFunction.ts
import { onCall } from 'firebase-functions/v2/https';

export const myFunction = onCall(async (request) => {
  if (!request.auth) throw new Error('Unauthorized');
  return { result: 'data' };
});
```

Export in `functions/src/index.ts`, call from frontend with `httpsCallable`.

### 16.3 Add a Store Slice

1. Create slice in `src/core/store/slices/mySlice.ts`
2. Import and add to `StoreState` interface in `store/index.ts`
3. Add to store creation spread

### 16.4 Debug Agent Issues

```typescript
// Enable verbose logging in AgentZero.ts
console.log('[AgentZero] Executing:', task);
console.log('[AgentZero] Context:', context);

// Browser console
window.useStore.getState().agentMessages;
```

---

## Appendix: Related Documentation

- **[AGENT_SYSTEM_ARCHITECTURE.md](./docs/AGENT_SYSTEM_ARCHITECTURE.md)** - Hub-and-Spoke model deep dive
- **[BACKEND_ARCHITECTURE.md](./docs/BACKEND_ARCHITECTURE.md)** - Vertex AI migration rationale
- **[UI_STATE.md](./docs/UI_STATE.md)** - Design system & branding
- **[RULES.md](./RULES.md)** - Agent Zero protocol & design standards
- **[MODEL_POLICY.md](./MODEL_POLICY.md)** - Strict model usage requirements
- **[ROADMAP.md](./ROADMAP.md)** - Future features & improvements

---

## Quick Reference

### Common Imports

```typescript
import { useStore } from '@/core/store';
import { AgentService } from '@/services/agent/AgentService';
import { db, auth, storage } from '@/services/firebase';
import { ImageGenerationService } from '@/services/image/ImageGenerationService';
```

### Key Constants

```typescript
// src/core/config/ai-models.ts
export const PRIMARY_MODEL = 'gemini-3-pro-preview';
export const IMAGE_MODEL = 'gemini-3-pro-image-preview';
```

### Debugging Commands

```bash
# Firestore emulator
firebase emulators:start --only firestore

# Type check
npx tsc --noEmit

# Lint
npx eslint . --fix
```

---

**End of CLAUDE.md**
