# indiiOS Application & Code Overview

This document bridges the product vision of indiiOS with how the codebase is organized. It is meant to help new contributors quickly understand what the platform offers, which surfaces deliver those capabilities, and where to look in the repository when implementing changes.

## Product definition

- **Creative operating system:** indiiOS unifies image generation, video production, music synthesis, campaign ops, and automation into one multi-tenant workspace.
- **Hub-and-spoke AI agents:** The generalist **indii** (Agent Zero) delegates to specialists (Legal, Marketing, Brand, Road, Music) with context about the active organization/project/brand kit.
- **Intelligence Layer (Gemini 3.0):** Powered exclusively by Gemini 3.0 Pro (High Thinking) and Flash (Preview models). Model policy is strictly enforced in `src/core/config/ai-models.ts`.
- **Enterprise posture:** Firebase-backed persistence, scoped data isolation, and cloud-hosted AI workloads (Vertex AI for video/image) support scale and quota controls.

## User journeys & surfaces

- **Landing page** (`landing-page/`): marketing site with Framer-motion hero, feature highlights, and CTA into the studio demos.
- **Studio web app** (`src/`, `public/`): core React experience that hosts the creative suites, Workflow Lab, and agent-driven chat utilities.
- **Electron shell** (`electron/`, `dist-electron/`): desktop packaging for studio parity with additional native menus and window controls.

## Core feature areas

- **Creative Studio** (`src/modules/creative`, `src/modules/showroom`): canvas/outpainting tools, asset remixing, and the product visualization “Showroom.”
- **Video Studio** (`src/modules/video`): idea-to-brief flow, review/QA ("Director's Cut"), and integration with backend video generation endpoints.
- **Music Analysis** (`src/modules/music`): audio analysis tools (BPM, key, energy) backed by the MusicAgent.
- **Workflow Lab** (`src/modules/workflow`): node-based automation editor for chaining AI tasks, designed to orchestrate image/video/music agents.
- **Operational suites** (`src/modules/marketing`, `src/modules/legal`, `src/modules/touring`, `src/modules/finance`, `src/modules/social`, etc.): campaign strategy, compliance checks, itineraries, and channel publishing.

## Frontend architecture highlights

- **App entry** (`src/main.tsx`): mounts the React app, global providers, and theme/state scaffolding.
- **Routing & layouts** (`src/app`): workspace shell, navigation, and layout primitives shared across modules.
- **Components & shared UI** (`src/components`, `src/shared`, `src/styles`): reusable UI atoms/molecules styled with Tailwind and animation helpers from Framer Motion/PixiJS.
- **State & services** (`src/services`, `src/core`, `src/utils`): API clients, Firebase bindings, agent/chat adapters, and utility helpers.
- **Types & contracts** (`src/types`): shared TypeScript models for agents, assets, workflows, and organization/project metadata.

## Agent system touchpoints

- **Agent registry & contracts** (`agents/`): specialist agent definitions (e.g., `agents/legal`, `agents/video`, `agents/music`) follow the BaseAgent pattern referenced in `docs/AGENT_SYSTEM_ARCHITECTURE.md`.
- **Tooling & prompts** (`agents/**/tools`, `agents/**/prompts`): co-located tool definitions and prompt templates per specialist.
- **RAG & Knowledge Management** (`src/services/rag`): Migrated to **Gemini File Search API** for native, long-context document retrieval. Managed stores replace legacy AQA/Corpus implementations.
- **Project Memory** (`src/services/agent/MemoryService.ts`): Firestore-backed semantic memory using `text-embedding-004` for project-specific facts and rules.
- **Context injection** (`src/services`): chat/agent services attach org/project/brand-kit metadata so the hub (indii) can delegate safely.

## Backend & cloud functions

- **Callable/HTTP endpoints** (`functions/scripts`): Firebase Functions for video/image generation and other heavy AI tasks, fronting Vertex AI models (Gemini 3.0, Veo 3.1).
- **Hosting config** (`firebase.json`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`): deployment rules for persistence and security.
- **Environment** (`.env.local`, `env-schema.json`): expected runtime secrets and validation schema for local development.

## Development workflow

- **Local dev**: `npm install` then `npm run dev` for the Vite server; `npm run electron` to launch the desktop shell.
- **Testing**: Playwright e2e specs in `e2e/`; verification scripts/logs under `verification/` and `test_results*.txt`.
- **Build & deploy**: `firebase deploy` for hosting/functions; `forge.config.cjs` and `electron-builder.json` manage desktop packaging.

## Maintenance & upgrade procedures

- **Model rotation**: To update models, modify `src/core/config/ai-models.ts`. Runtime validation will prevent usage of legacy (1.5/2.0) models.
- **Agent updates**: Specialists follow the `BaseAgent` pattern. Update tools in `src/services/agent/tools.ts` and logic in the agent's definition file.
- **Deployment**:
  - **Studio**: `npm run build:studio` then `firebase deploy --only hosting`.
  - **Cloud Functions**: `firebase deploy --only functions`.
  - **Desktop**: `npm run electron:build` for production packaging.

## How to extend the platform

1. **Choose the surface** (web module vs. Electron shell) and locate the corresponding directory noted above.
2. **Wire agents intentionally**: register tools/prompts near their specialist under `agents/` and route through the hub so context stays scoped.
3. **Offload heavy jobs**: prefer Firebase Functions + Vertex AI (or Gemini API) for generation workloads; keep the client focused on orchestration and UX.
4. **Preserve multi-tenancy**: respect organization/project boundaries in Firestore queries and UI state; avoid cross-tenant leakage in agent prompts.
5. **Memory & RAG**: New documents should be uploaded via `GeminiRetrievalService` to the File Search Store. Persistent project facts should be saved via `MemoryService`.
