<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# indiiOS: The AI-Native Creative Studio

**The Operating System for Independent Artists**

indiiOS is a multi-tenant, AI-native creative platform that unifies image generation, video production, music synthesis, distribution, and campaign management into a single intelligent workspace. Powered by a hub-and-spoke agent architecture that maintains consistent context across every surface.

[![Firebase Hosting](https://img.shields.io/badge/Firebase-Hosted-FFCA28?logo=firebase)](https://indiios-studio.web.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## Features

### Creative Studios

| Module              | Description                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Creative Studio** | Infinite canvas for AI image generation, editing, and product visualization ("Showroom") |
| **Video Studio**    | Idea-to-brief-to-render pipeline with QA checkpoints ("Director's Cut") using Veo 3.1    |
| **Music Studio**    | Audio analysis tools (BPM, key, energy extraction) powered by Essentia.js                |
| **Workflow Lab**    | Node-based automation editor to chain AI tasks across suites                             |

### Business Operations

| Module                        | Description                                                    |
| ----------------------------- | -------------------------------------------------------------- |
| **Publishing & Distribution** | Multi-distributor release management with DDEX ERN/DSR support |
| **Finance**                   | Revenue tracking, royalty management, and financial analytics  |
| **Marketing**                 | Campaign management, brand assets, and AI copywriting          |
| **Legal**                     | Contract review, rights management, and compliance tools       |
| **Touring**                   | Road management and tour planning                              |

### Distribution Integrations

- **DistroKid** - Direct API integration
- **TuneCore** - Full release management
- **CD Baby** - Standard distribution
- **Symphonic** - DDEX-compliant delivery
- **DDEX Support** - ERN message generation, DSR report parsing

### Agent System

- **Hub (indii)** - Orchestrates conversations, injects org/project context, delegates to specialists
- **Specialists** - Legal, Marketing, Brand, Road Manager, Music, Video, Creative Director, and **Browser** agents
- **Autonomous Browser Agent** - Fully self-driving Puppeteer instance powered by `gemini-2.5-pro-ui-checkpoint` for real-time web discovery and data extraction.
- **Context Safety** - Firestore-scoped lookups ensure responses stay within the active workspace

### Electron Desktop Application

- **Browser Agent Integration** - Native Puppeteer IPC for web discovery and automation
- **SFTP/SSH2 Integration** - Direct distributor file uploads and DDEX delivery
- **Keytar Integration** - Secure credential storage in OS keychain
- **Platform-Specific Features** - File system access, native dialogs, and tray notifications
- **Security Hardened** - Sandbox enabled, Context Isolation active, strict Content Security Policy

---

### Hub-and-Spoke Agent Model

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
   │  Road  │  │ Music  │  │Finance │
   │Manager │  │ Agent  │  │ Agent  │
   └────────┘  └────────┘  └────────┘
```

### Frontend/Backend Split

| Layer        | Technologies                    | Purpose                                     |
| ------------ | ------------------------------- | ------------------------------------------- |
| **Frontend** | React 19, Vite, Zustand         | UI, real-time chat, canvas editing          |
| **Backend**  | Firebase Functions (Node.js 22) | Heavy AI workloads, rate limiting, security |
| **AI**       | Gemini 3.x, Veo 3.1, Vertex AI  | Text, image, and video generation           |

---

## Tech Stack

### Frontend

- **Framework:** React 19.2 + Vite 6.2
- **Styling:** TailwindCSS v4.1 (CSS-first config)
- **State:** Zustand 5.0
- **Animation:** Framer Motion 12.x
- **Canvas:** Fabric.js 6.9, React Flow 11.11
- **Audio:** Tone.js 15.1, Wavesurfer.js 7.11, Essentia.js 0.1.3
- **Video:** Remotion 4.0 (Player, Renderer, Lambda)

### Backend

- **Platform:** Firebase (Hosting, Functions, Firestore, Storage)
- **Runtime:** Node.js 22 (Gen 2 Functions)
- **AI SDK:** Genkit AI 1.26, Google GenAI 1.30
- **Jobs:** Inngest 3.46

### Desktop

- **Framework:** Electron 33
- **Automation:** Puppeteer (Main Process)
- **Packaging:** Electron Forge
- **Security:** Keytar for credential storage

### AI Models

| Purpose           | Model                          |
| ----------------- | ------------------------------ |
| Complex Reasoning | `gemini-3-pro-preview`         |
| Fast Tasks        | `gemini-3-flash-preview`       |
| Image Generation  | `gemini-3-pro-image-preview`   |
| Video Generation  | `veo-3.1-generate-preview`     |
| Browser Agent     | `gemini-2.5-pro-ui-checkpoint` |

---

## Quick Start

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **Firebase CLI** (`npm install -g firebase-tools`)
- **Google Cloud** access with Vertex AI enabled

### 1. Clone and Install

```bash
git clone https://github.com/the-walking-agency-det/indiiOS-Alpha-Electron.git
cd indiiOS-Alpha-Electron
npm install
```

### 2. Environment Configuration

Create a `.env` file in the project root:

```env
# Required - Gemini API
VITE_GEMINI_API_KEY=your_gemini_api_key

# Required - Firebase Configuration (JSON string)
VITE_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}

# Required for video generation
VITE_VERTEX_PROJECT_ID=your_gcp_project_id
VITE_VERTEX_LOCATION=us-central1

# Optional - Google Maps
VITE_GOOGLE_MAPS_API_KEY=your_maps_api_key

# Optional - Distribution APIs
DISTROKID_API_KEY=your_distrokid_key
TUNECORE_API_KEY=your_tunecore_key
```

### 3. Development Modes

**Web Studio (Browser)**

```bash
npm run dev
# Opens at http://localhost:5173
```

**Electron Desktop App**

```bash
# Start Vite dev server first
npm run dev

# In another terminal, launch Electron
npm run electron:dev
```

**Firebase Emulators (Local Backend)**

```bash
cd functions
npm install
npm run build
firebase emulators:start
```

### 4. Build & Deploy

```bash
# Build web studio
npm run build

# Build landing page
npm run build:landing

# Build both
npm run build:all

# Deploy to Firebase
firebase deploy
```

---

## Project Structure

```
indiiOS-Alpha-Electron/
├── src/                          # Frontend source
│   ├── core/                     # App infrastructure
│   │   ├── App.tsx              # Main entry
│   │   ├── store.ts             # Zustand store root
│   │   ├── store/slices/        # State slices
│   │   ├── components/          # Sidebar, CommandBar, etc.
│   │   └── config/              # AI model configs
│   ├── modules/                  # Feature modules
│   │   ├── auth/                # Authentication
│   │   ├── creative/            # Image generation
│   │   ├── video/               # Video production
│   │   ├── music/               # Audio analysis
│   │   ├── workflow/            # Node editor
│   │   ├── marketing/           # Campaigns
│   │   ├── publishing/          # Distribution
│   │   ├── finance/             # Revenue tracking
│   │   └── legal/               # Contracts
│   ├── services/                 # Business logic
│   │   ├── agent/               # AgentZero + specialists
│   │   ├── ai/                  # AI service wrappers
│   │   ├── distribution/        # Multi-distributor facade
│   │   ├── ddex/                # ERN/DSR handling
│   │   └── security/            # Credential management
│   └── components/               # Shared UI
├── functions/                    # Firebase Cloud Functions
│   └── src/
│       ├── agents/              # Backend agents
│       ├── ai/                  # Vertex AI wrappers
│       └── inngest/             # Job workflows
├── electron/                     # Desktop wrapper
│   ├── main.ts                  # Main process
│   └── preload.ts               # Preload scripts
├── landing-page/                 # Marketing site (Next.js)
├── e2e/                          # Playwright tests
└── docs/                         # Documentation
```

---

## Development

### Scripts

| Command                  | Description              |
| ------------------------ | ------------------------ |
| `npm run dev`            | Start Vite dev server    |
| `npm run build`          | Build production bundle  |
| `npm run electron:dev`   | Run Electron in dev mode |
| `npm run electron:build` | Build Electron app       |
| `npm run test`           | Run Vitest unit tests    |
| `npm run test:e2e`       | Run Playwright E2E tests |
| `npm run lint`           | Lint with ESLint         |
| `npm run lint:fix`       | Auto-fix lint issues     |

### Code Conventions

- **Imports:** Use `@/` alias (e.g., `import { useStore } from '@/core/store'`)
- **Components:** Functional components with TypeScript interfaces
- **State:** Zustand slices for domain-specific state
- **Styling:** TailwindCSS v4 with CSS-first configuration

### Store Architecture

```typescript
import { useStore } from "@/core/store";

function MyComponent() {
  // Select only needed state
  const activeModule = useStore((state) => state.activeModule);
  const { user, activeOrg } = useStore((state) => ({
    user: state.user,
    activeOrg: state.activeOrg,
  }));
}
```

---

## Testing

### Unit Tests (Vitest)

```bash
# Run all tests
npm run test

# Watch mode
npm run test -- --watch

# With coverage
npm run test -- --coverage
```

### E2E Tests (Playwright)

```bash
# Headless
npm run test:e2e

# Interactive UI
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

### Test Structure

- **Unit tests:** Co-located with source (`*.test.ts`)
- **E2E tests:** Located in `e2e/` directory
- **Fixtures:** `src/test/setup.ts` configures mocks

---

## Deployment

### Firebase Hosting

| Target  | Site ID          | URL                              |
| ------- | ---------------- | -------------------------------- |
| Landing | `indiios-v-1-1`  | <https://indiios-v-1-1.web.app>  |
| Studio  | `indiios-studio` | <https://indiios-studio.web.app> |

### Manual Deployment

```bash
# Build and deploy everything
npm run build:all && firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy specific function
firebase deploy --only functions:generateImage
```

### GitHub Actions

Automated deployment triggers on push to `main` branch. See `.github/workflows/deploy.yml`.

**Required Secrets:**

- `VITE_API_KEY`
- `VITE_VERTEX_PROJECT_ID`
- `VITE_VERTEX_LOCATION`
- `FIREBASE_SERVICE_ACCOUNT`

---

## Documentation

| Document                                                                 | Description                              |
| ------------------------------------------------------------------------ | ---------------------------------------- |
| [CLAUDE.md](./CLAUDE.md)                                                 | Comprehensive AI assistant guide         |
| [ROADMAP.md](./ROADMAP.md)                                               | Feature roadmap and technical debt       |
| [MODEL_POLICY.md](./MODEL_POLICY.md)                                     | AI model usage requirements              |
| [RULES.md](./RULES.md)                                                   | Agent Zero protocol and design standards |
| [docs/AGENT_SYSTEM_ARCHITECTURE.md](./docs/AGENT_SYSTEM_ARCHITECTURE.md) | Hub-and-spoke design details             |
| [docs/AUTONOMOUS_BROWSER_AGENT.md](./docs/AUTONOMOUS_BROWSER_AGENT.md)   | Self-driving browser internals           |
| [docs/BACKEND_ARCHITECTURE.md](./docs/BACKEND_ARCHITECTURE.md)           | Firebase + Vertex AI service map         |
| [docs/DDEX_IMPLEMENTATION_PLAN.md](./docs/DDEX_IMPLEMENTATION_PLAN.md)   | Distribution integration details         |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run linting before commits (`npm run lint:fix`)
4. Commit with clear messages
5. Push and create a Pull Request

### Before Submitting

- [ ] Tests pass (`npm run test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] E2E tests pass (`npm run test:e2e`)

---

## License

Proprietary - IndiiOS LLC

---

<div align="center">
  <sub>Built with AI for independent artists</sub>
</div>
