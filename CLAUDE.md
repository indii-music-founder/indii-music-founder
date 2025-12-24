# CLAUDE.md - AI Assistant's Guide to indiiOS

**Last Updated:** 2025-12-05
**Repository:** Rndr-AI-v1 (indiiOS - The AI-Native Creative Studio)
**Purpose:** Comprehensive guide for AI assistants to understand codebase structure, conventions, and development workflows.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Codebase Structure](#2-codebase-structure)
3. [Architecture](#3-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Development Setup](#5-development-setup)
6. [Key Conventions & Standards](#6-key-conventions--standards)
7. [State Management](#7-state-management)
8. [Multi-Tenancy & Security](#8-multi-tenancy--security)
9. [AI & Agent System](#9-ai--agent-system)
10. [Module Reference](#10-module-reference)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment](#12-deployment)
13. [Critical Gotchas](#13-critical-gotchas)
14. [Common Tasks](#14-common-tasks)

---

## 1. Project Overview

**indiiOS** is a multi-tenant, AI-native creative platform that unifies image generation, video production, music synthesis, and campaign management into a single intelligent workspace.

### Core Features

- **Creative Studio:** Infinite canvas for image generation and editing
- **Video Studio:** AI-powered video production with Director's Cut QA
- **Music Analysis:** Audio analysis (BPM, key, energy extraction)
- **Workflow Lab:** Node-based automation for chaining AI tasks
- **Multi-Agent System:** Specialized AI agents (Legal, Marketing, Brand, Road Manager, Music)

### Live Deployments

- **Landing Page:** <https://indiios-v-1-1.web.app>
- **Studio App:** <https://indiios-studio.web.app>

---

## 2. Codebase Structure

```
Rndr-AI-v1/
├── src/                          # Frontend source code
│   ├── core/                     # Core app infrastructure
│   │   ├── App.tsx              # Main application entry
│   │   ├── store.ts             # Zustand store root
│   │   ├── store/slices/        # Store slices (auth, agent, creative, etc.)
│   │   ├── components/          # Core UI components (Sidebar, CommandBar, etc.)
│   │   ├── config/              # AI model configs
│   │   └── theme/               # Module color schemes
│   ├── modules/                  # Feature modules
│   │   ├── auth/                # Authentication & org selection
│   │   ├── creative/            # Creative Studio (image generation)
│   │   ├── video/               # Video Studio
│   │   ├── music/               # Music Analysis
│   │   ├── workflow/            # Workflow Lab (node editor)
│   │   ├── marketing/           # Marketing & Campaign management
│   │   ├── legal/               # Legal dashboard
│   │   ├── dashboard/           # Main dashboard
│   │   └── onboarding/          # User onboarding
│   ├── services/                 # Business logic layer
│   │   ├── agent/               # Agent system (AgentZero, specialists)
│   │   ├── ai/                  # AI service wrappers
│   │   ├── image/               # Image generation services
│   │   ├── video/               # Video generation services
│   │   ├── rag/                 # RAG & file search
│   │   └── firebase.ts          # Firebase initialization
│   ├── components/               # Shared UI components
│   │   ├── ui/                  # Base UI components
│   │   ├── kokonutui/           # KokonutUI components
│   │   └── motion-primitives/   # Animation components
│   └── lib/                      # Utility functions
├── functions/                    # Firebase Cloud Functions (Backend)
│   └── src/
│       ├── agents/              # Backend agent implementations
│       ├── ai/                  # Vertex AI & Gemini wrappers
│       ├── rag/                 # RAG backend
│       ├── inngest/             # Inngest job workflows
│       └── index.ts             # Function exports
├── docs/                         # Documentation
│   ├── AGENT_SYSTEM_ARCHITECTURE.md
│   ├── BACKEND_ARCHITECTURE.md
│   └── UI_STATE.md
├── e2e/                          # Playwright E2E tests
├── landing-page/                 # Separate Next.js landing page
├── electron/                     # Electron app wrapper
├── .agent/workflows/             # Agent workflow definitions
├── RULES.md                      # Operational rules & Agent Zero protocol
├── MODEL_POLICY.md               # Strict model usage policy
└── ROADMAP.md                    # Future plans
```

### Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts (uses "indii-os" as name) |
| `vite.config.ts` | Vite build config, aliases (`@/` → `src/`) |
| `tsconfig.json` | TypeScript config (ES2022, strict mode) |
| `firebase.json` | Firebase hosting targets (studio + landing) |
| `firestore.rules` | Security rules for multi-tenancy |
| `components.json` | Shadcn UI component config |
| `.env` / `.env.example` | Environment variables (API keys) |

---

## 3. Architecture

### 3.1 Frontend/Backend Split

**Frontend (Client-Side):**

- React 19 + Vite
- Text/chat uses `GoogleGenerativeAI` SDK directly for low-latency
- State managed by Zustand
- Firebase SDK for auth, Firestore, storage

**Backend (Cloud Functions):**

- Firebase Functions (Node.js 22, Gen 2)
- Vertex AI for image/video generation
- Agent execution runs server-side
- IAM Service Accounts (no exposed keys)

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
        ┌───────────┼───────────┐
        │           │           │
   ┌────▼───┐  ┌───▼────┐  ┌──▼─────┐
   │ Legal  │  │ Brand  │  │Marketing│
   │ Agent  │  │ Agent  │  │  Agent  │
   └────────┘  └────────┘  └────────┘
        │           │           │
   ┌────▼───┐  ┌───▼────┐  ┌──▼─────┐
   │  Road  │  │ Music  │  │Campaign│
   │Manager │  │ Agent  │  │ Manager│
   └────────┘  └────────┘  └────────┘
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

---

## 4. Tech Stack

### Frontend

- **Framework:** React 19.2.0
- **Build:** Vite 6.2.0
- **Styling:** TailwindCSS v4.1.17 (CSS-first config)
- **State:** Zustand 5.0.8
- **Animation:** Framer Motion 12.23.24
- **3D/Canvas:** Fabric.js 6.9.0, React Three Fiber (via Remotion)
- **Audio:** Tone.js 15.1.22, Wavesurfer.js 7.11.1, Essentia.js 0.1.3
- **Video:** Remotion 4.0.382 (Player, Renderer, Lambda)
- **Workflow:** React Flow 11.11.4
- **Icons:** Lucide React 0.555.0
- **Markdown:** React Markdown 10.1.0

### Backend

- **Platform:** Firebase (Hosting, Functions, Firestore, Storage, Analytics)
- **Runtime:** Node.js 22
- **AI SDK:** `@genkit-ai/ai` 1.25.0, `@google/genai` 1.30.0
- **Jobs:** Inngest 3.46.0

### AI Models (STRICT POLICY - See MODEL_POLICY.md)

- **Image:** `gemini-3-pro-image-preview` (Nano Banana Pro)
- **Text/Reasoning:** `gemini-3-flash-preview` (Fast), `gemini-3-pro-preview` (Reasoning)
- **Video:** `veo-3.1-generate-preview` (Standard)
- **Forbidden:** Gemini 1.5 Pro, Gemini 1.5 Flash (Use Gemini 3 equivalents)

### Testing

- **Unit:** Vitest 4.0.15 + Testing Library
- **E2E:** Playwright 1.57.0
- **Environment:** jsdom, fake-indexeddb

---

## 5. Development Setup

### Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

```bash
# Clone and install
git clone <repo-url>
cd Rndr-AI-v1
npm install

# Environment setup
cp .env.example .env
# Edit .env with your keys:
# - VITE_GEMINI_API_KEY
# - VITE_FIREBASE_CONFIG (JSON string)
```

### Development Commands

```bash
# Frontend development
npm run dev                    # Start Vite dev server (port 5173)

# Building
npm run build                  # Build studio app
npm run build:landing          # Build landing page
npm run build:all              # Build both

# Testing
npm run test                   # Run Vitest unit tests
npm run test:e2e               # Run Playwright E2E tests

# Electron (Desktop App)
npm run electron:dev           # Development mode
npm run electron:build         # Production build

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

## 6. Key Conventions & Standards

### 6.1 The Agent Zero Evolution Protocol (from RULES.md)

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

### 6.2 Design Currency (2025 Standards)

**From RULES.md:**

- **Framework:** Tailwind CSS v4 (CSS-first config) exclusively
- **Typography:** Variable fonts only (Inter, Geist)
- **Aesthetic:** "Liquid Logic" - glassmorphism, subtle borders (`border-white/5`), organic 3D shapes
- **Linting:** Run `npx eslint . --fix` before every code submission

### 6.3 Code Style

**TypeScript:**

- Strict mode enabled
- ES2022 target
- Use `@/` alias for imports (e.g., `import { useStore } from '@/core/store'`)
- No unused parameters/locals enforcement (disabled in tsconfig)

**React:**

- Functional components only
- Hooks for state/effects
- Prop types via TypeScript interfaces

**File Naming:**

- Components: PascalCase (e.g., `CreativeStudio.tsx`)
- Services: PascalCase (e.g., `AgentService.ts`)
- Utilities: camelCase (e.g., `validationUtils.ts`)
- Tests: `*.test.ts` or `*.test.tsx` or `__tests__/` directory

### 6.4 Model Usage Policy (CRITICAL)

> **WARNING: Runtime validation is enabled. Using forbidden models will CRASH the app on startup.**

**From MODEL_POLICY.md - STRICTLY ENFORCED:**

#### Approved Models (ONLY THESE ARE ALLOWED)

| Purpose | Constant | Model ID |
|---------|----------|----------|
| Complex reasoning | `AI_MODELS.TEXT.AGENT` | `gemini-3-pro-preview` |
| Fast tasks | `AI_MODELS.TEXT.FAST` | `gemini-3-flash-preview` |
| Image generation | `AI_MODELS.IMAGE.GENERATION` | `gemini-3-pro-image-preview` |
| Video generation | `AI_MODELS.VIDEO.GENERATION` | `veo-3.1-generate-preview` |

#### Forbidden Models (WILL CRASH APP)

- `gemini-1.5-flash`, `gemini-1.5-pro` (ALL 1.5 variants are BANNED)
- `gemini-2.0-flash`, `gemini-2.0-pro` (ALL 2.0 variants are BANNED)
- `gemini-pro`, `gemini-pro-vision` (legacy BANNED)
- Any model not explicitly listed in `Approved Models` above.

#### Correct Usage

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

**Why:** Gemini 3.x is the current generation. Legacy models are deprecated and incompatible with Gemini 3 API features (thinking levels, thought signatures).

---

## 7. State Management

### 7.1 Zustand Store Architecture

**Central Store:** `src/core/store.ts`

```typescript
type AppState = AppSlice & AuthSlice & AgentSlice & CreativeSlice & WorkflowSlice;
export const useStore = create<AppState>(...);
```

**Slices:**

| Slice | File | Responsibilities |
|-------|------|------------------|
| `AppSlice` | `slices/appSlice.ts` | Active module, sidebar, theme, toasts |
| `AuthSlice` | `slices/authSlice.ts` | User, organizations, active org/project |
| `AgentSlice` | `slices/agentSlice.ts` | Chat messages, agent state, persona |
| `CreativeSlice` | `slices/creativeSlice.ts` | Images, canvas state, history, prompts |
| `WorkflowSlice` | `slices/workflowSlice.ts` | Workflow nodes, edges, execution |

### 7.2 Usage Pattern

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

### 7.3 Store Debugging

```javascript
// Store is exposed globally for debugging
window.useStore.getState();        // Get full state
window.useStore.setState({...});   // Update state (use cautiously)
```

---

## 8. Multi-Tenancy & Security

### 8.1 Data Isolation Model

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

### 8.2 Firestore Security Rules

**From `firestore.rules`:**

```javascript
// Organizations: User must be in members array
allow read: if request.auth.uid in resource.data.members;

// Projects: User must be org member
allow read: if isOrgMember(resource.data.orgId);

// History, Assets: Same org-scoped rules
```

**Helper Function:**

```javascript
function isOrgMember(orgId) {
  return request.auth.uid in get(/databases/$(database)/documents/organizations/$(orgId)).data.members;
}
```

### 8.3 Frontend Context Injection

**AgentService automatically injects:**

- Active organization name
- Active project name
- Brand Kit (if present)
- User profile

**Example:**

```typescript
// In AgentZero.ts
const context = `
Organization: ${activeOrg.name}
Project: ${activeProject.name}
Brand Kit: ${brandKit ? 'Yes' : 'None'}
`;
```

---

## 9. AI & Agent System

### 9.1 Agent Lifecycle

**1. User sends message → AgentService**

```typescript
// src/services/agent/AgentService.ts
async chat(message: string) {
  // Add user message to history
  // Call AgentZero with context
  const response = await agentZero.execute(message, context);
}
```

**2. AgentZero analyzes request**

```typescript
// src/services/agent/AgentZero.ts
async execute(task: string, context: Context) {
  // Decide: Handle directly OR delegate
  // If delegate, use 'delegate_task' tool
}
```

**3. Delegation (if needed)**

```typescript
// AgentZero calls delegate_task
{
  agent_id: 'legal',
  task: 'Review this contract for IP clauses',
  context: { /* relevant context */ }
}
```

**4. Specialist execution**

```typescript
// src/services/agent/specialists/LegalAgent.ts
class LegalAgent extends BaseAgent {
  async execute(task, context) {
    // Use specialized tools
    // Return structured result
  }
}
```

**5. Result flows back to user**

### 9.2 Adding a New Specialist Agent

**Step 1:** Create agent file

```typescript
// src/services/agent/specialists/MyAgent.ts
import { BaseAgent } from './BaseAgent';

export class MyAgent extends BaseAgent {
  id = 'my-agent';
  name = 'My Agent';
  systemPrompt = 'You are an expert in...';

  tools = [
    {
      functionDeclarations: [{
        name: 'my_tool',
        description: 'Does something',
        parameters: {
          type: 'OBJECT',
          properties: { arg: { type: 'STRING' } },
          required: ['arg']
        }
      }]
    }
  ];

  constructor() {
    super();
    this.functions = {
      my_tool: async (args) => {
        // Implementation
        return { result: 'data' };
      }
    };
  }
}
```

**Step 2:** Register in `AgentRegistry`

```typescript
// src/services/agent/registry.ts
import { MyAgent } from './specialists/MyAgent';

AgentRegistry.register(new MyAgent());
```

**Step 3:** Update `delegate_task` tool description

```typescript
// List valid agent IDs: 'legal', 'marketing', 'my-agent'
```

### 9.3 Tool Calling Standard

**From AGENT_SYSTEM_ARCHITECTURE.md:**

**Critical Fix:** Google AI SDK exposes text via **method** `response.text()`, NOT property.

```typescript
// ✅ CORRECT
const response = await AI.generateContent({...});
const text = response.text(); // Method call

// ❌ WRONG (returns undefined)
const text = response.text; // Property access
```

**Tool Implementation Pattern:**

```typescript
this.functions = {
  tool_name: async (args) => {
    // REAL IMPLEMENTATION - No mocks in production
    const response = await AI.generateContent({...});
    return AI.parseJSON(response.text());
  }
};
```

---

## 10. Module Reference

### 10.1 Creative Studio (`src/modules/creative/`)

**Purpose:** Image generation, infinite canvas, product showroom

**Key Components:**

- `CreativeStudio.tsx` - Main container
- `InfiniteCanvas.tsx` - Fabric.js canvas with pan/zoom
- `PromptBuilder.tsx` - AI-powered prompt construction
- `Showroom.tsx` - 3D product visualization

**Services:**

- `ImageGenerationService.ts` - Calls backend `generateImage` function
- `VideoDirector.ts` - Image-to-video director's cut

**State:**

- `creativeSlice.ts` - Images, canvas state, history

**README:** `src/modules/creative/README.md`

### 10.2 Video Studio (`src/modules/video/`)

**Purpose:** AI video production workflow (Idea → Brief → Review)

**Key Components:**

- `VideoStudio.tsx` - Main container
- `VideoEditor.tsx` - Timeline editor
- `VideoPlayer.tsx` - Remotion Player wrapper

**Services:**

- `VideoGenerationService.ts` - Vertex AI Veo integration

**State:**

- `videoEditorStore.ts` - Separate Zustand store for video editing

**README:** `src/modules/video/README.md`

### 10.3 Music Analysis (`src/modules/music/`)

**Purpose:** Audio analysis (BPM, key, energy extraction), frequency visualization

**Key Components:**

- `MusicStudio.tsx` - Main container
- `AudioAnalyzer.tsx` - Waveform & spectrum display

**Services:**

- `AudioAnalysisEngine.ts` - Essentia.js integration for audio features

**README:** `src/modules/music/README.md`

### 10.4 Workflow Lab (`src/modules/workflow/`)

**Purpose:** Node-based automation for chaining AI tasks

**Key Components:**

- `WorkflowLab.tsx` - React Flow editor
- `WorkflowEngine.ts` - Execution engine
- `nodeRegistry.ts` - Available node types

**Services:**

- `workflowPersistence.ts` - Firestore sync

**README:** `src/modules/workflow/README.md`

### 10.5 Marketing (`src/modules/marketing/`)

**Purpose:** Campaign management, brand assets, copywriting

**Key Components:**

- `BrandManager.tsx` - Brand kit editor
- `CampaignManager.tsx` - Campaign lifecycle
- `MapsComponent.tsx` - Google Maps for geo-targeting

**Agents:**

- `BrandAgent` - Brand consistency analysis
- `MarketingAgent` - Campaign strategy
- `CampaignManager` - Execution orchestration

**README:** `src/modules/marketing/README.md`

### 10.6 Legal (`src/modules/legal/`)

**Purpose:** Contract review, rights management, compliance

**Agents:**

- `LegalAgent` - Contract analysis, IP clause extraction

**README:** `src/modules/legal/README.md`

---

## 11. Testing Strategy

### 11.1 Unit Tests (Vitest)

**Location:** Co-located with source (`.test.ts` suffix) or `__tests__/` directory

**Setup:** `src/test/setup.ts`

- Mocks `firebase` SDK
- Provides `fake-indexeddb`
- Configures Testing Library

**Running:**

```bash
npm run test              # All tests
npm run test -- --ui      # Visual UI
npm run test -- MyComponent  # Specific file
```

**Example:**

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### 11.2 E2E Tests (Playwright)

**Location:** `e2e/` directory

**Key Tests:**

- `user-flow.spec.ts` - Full user journey
- `agent-flow.spec.ts` - Agent interaction
- `stress-test.spec.ts` - Performance & load

**Running:**

```bash
npm run test:e2e                    # Headless
npx playwright test --ui            # Interactive
npx playwright test --debug         # Debug mode
```

### 11.3 Coverage Expectations

- **Critical Paths:** AgentService, Specialists, Store slices
- **UI Components:** Snapshot tests for complex components
- **Services:** Mock external APIs (Firebase, Vertex AI)

---

## 12. Deployment

### 12.1 Hosting Architecture

**Firebase Hosting with multiple targets:**

| Target | Site ID | Directory | URL |
|--------|---------|-----------|-----|
| Landing | `indiios-v-1-1` | `landing-page/out` | <https://indiios-v-1-1.web.app> |
| Studio | `indiios-studio` | `dist` | <https://indiios-studio.web.app> |

**Config:** `firebase.json`

### 12.2 GitHub Actions Workflow

**File:** `.github/workflows/deploy.yml`

**Triggers:**

- Push to `main` branch
- Manual workflow dispatch

**Steps:**

1. Checkout repository
2. Setup Node.js 20.x
3. Install dependencies (root + landing-page)
4. Build landing page (`npm run build:landing`)
5. Build studio app (`npm run build:studio`)
6. Deploy to Firebase Hosting (both targets)

**Secrets Required:**

- `VITE_API_KEY`
- `VITE_VERTEX_PROJECT_ID`
- `VITE_VERTEX_LOCATION`
- `FIREBASE_SERVICE_ACCOUNT`

### 12.3 Manual Deployment

```bash
# Build all
npm run build:all

# Deploy hosting only
firebase deploy --only hosting

# Deploy functions + hosting
firebase deploy

# Deploy specific function
firebase deploy --only functions:generateImage
```

### 12.4 Environment Variables

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

## 13. Critical Gotchas

### 13.1 Google AI SDK Response Handling

**Problem:** `response.text()` is a method, not a property.

```typescript
// ❌ WRONG - Returns undefined
const text = response.text;

// ✅ CORRECT
const text = response.text();
```

**Impact:** Silent failures in fallback logic, agent responses appearing empty.

### 13.2 Agent Tool Hallucinations

**Problem:** Orchestrator can hallucinate agent names (e.g., "social_media_agent" instead of "marketing").

**Fix:** Strictly type `agent_id` parameter and list valid IDs in tool description:

```typescript
{
  name: 'delegate_task',
  parameters: {
    agent_id: {
      type: 'STRING',
      description: 'Valid IDs: legal, marketing, brand, road-manager, music'
    }
  }
}
```

### 13.3 Firestore Query Constraints

**Problem:** Compound queries require composite indexes.

**Fix:** Run query in dev, copy index creation link from error, add to `firestore.indexes.json`.

**Example:**

```json
{
  "indexes": [
    {
      "collectionGroup": "history",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "orgId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### 13.4 Vite Build Chunk Size Warnings

**Problem:** Large dependencies causing chunking warnings.

**Fix:** Manual chunks configured in `vite.config.ts`:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'framer-motion'],
  'vendor-firebase': ['firebase/app', 'firebase/auth', ...],
  // etc.
}
```

### 13.5 Tailwind v4 Migration

**Problem:** v3 config patterns don't work with v4 CSS-first approach.

**Fix:** Use CSS variables for theming, import Tailwind in `index.css`:

```css
@import 'tailwindcss';
```

### 13.6 Firebase Functions Cold Starts

**Problem:** First request after idle period is slow (5-10s).

**Mitigation:**

- Use Gen 2 functions (faster cold starts)
- Increase min instances for critical functions (costs more)
- Implement request queueing with Inngest

---

## 14. Common Tasks

### 14.1 Add a New Module

**1. Create module directory:**

```bash
mkdir -p src/modules/my-module
touch src/modules/my-module/{MyModule.tsx,README.md}
```

**2. Define component:**

```typescript
// src/modules/my-module/MyModule.tsx
export default function MyModule() {
  return <div>My Module</div>;
}
```

**3. Add route in `App.tsx`:**

```typescript
{activeModule === 'my-module' && <MyModule />}
```

**4. Add to sidebar navigation:**

```typescript
// src/core/components/Sidebar.tsx
{ id: 'my-module', label: 'My Module', icon: <Icon /> }
```

**5. Update `appSlice.ts` type:**

```typescript
type ModuleId = 'dashboard' | 'creative' | 'my-module' | ...;
```

### 14.2 Add a Cloud Function

**1. Define function:**

```typescript
// functions/src/myFunction.ts
import { onCall } from 'firebase-functions/v2/https';

export const myFunction = onCall(async (request) => {
  // Verify auth
  if (!request.auth) throw new Error('Unauthorized');

  // Logic
  return { result: 'data' };
});
```

**2. Export in `functions/src/index.ts`:**

```typescript
export { myFunction } from './myFunction';
```

**3. Call from frontend:**

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const myFunction = httpsCallable(functions, 'myFunction');
const result = await myFunction({ arg: 'value' });
```

### 14.3 Add a Store Slice

**1. Create slice file:**

```typescript
// src/core/store/slices/mySlice.ts
export interface MySlice {
  myData: string;
  setMyData: (data: string) => void;
}

export const createMySlice: StateCreator<MySlice> = (set) => ({
  myData: '',
  setMyData: (data) => set({ myData: data }),
});
```

**2. Combine in `store.ts`:**

```typescript
import { createMySlice, MySlice } from './slices/mySlice';

type AppState = ... & MySlice;

export const useStore = create<AppState>((...a) => ({
  ...createMySlice(...a),
  ...
}));
```

### 14.4 Update AI Model

**Critical:** Follow MODEL_POLICY.md strictly.

```typescript
// ✅ CORRECT
const model = genAI.getGenerativeModel({
  model: 'gemini-3-pro-preview'
});

// Update in:
// - src/core/config/ai-models.ts
// - functions/src/ai/gemini.ts
```

### 14.5 Debug Agent Issues

**1. Enable verbose logging:**

```typescript
// src/services/agent/AgentZero.ts
console.log('[AgentZero] Executing:', task);
console.log('[AgentZero] Context:', context);
console.log('[AgentZero] Response:', response);
```

**2. Check agent registry:**

```javascript
// Browser console
window.useStore.getState().agentMessages;
```

**3. Verify tool definitions:**

```typescript
// Check tools array has correct JSON schema
// Verify function implementations exist in constructor
```

**4. Test specialist directly:**

```typescript
import { LegalAgent } from '@/services/agent/specialists/LegalAgent';
const agent = new LegalAgent();
const result = await agent.execute('test task', {});
console.log(result);
```

---

## Appendix: Related Documentation

- **[AGENT_SYSTEM_ARCHITECTURE.md](./docs/AGENT_SYSTEM_ARCHITECTURE.md)** - Deep dive into Hub-and-Spoke model
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
// src/modules/creative/constants.ts
export const DEFAULT_IMAGE_SIZE = { width: 1024, height: 1024 };
export const MAX_CANVAS_ZOOM = 5;

// src/core/config/ai-models.ts
export const PRIMARY_MODEL = 'gemini-3-pro-preview';
export const IMAGE_MODEL = 'gemini-3-pro-image-preview';
```

### Debugging Commands

```bash
# Firestore emulator
firebase emulators:start --only firestore

# Check bundle size
npm run build -- --report

# Type check
npx tsc --noEmit

# Lint
npx eslint . --fix
```

---

**End of CLAUDE.md**
