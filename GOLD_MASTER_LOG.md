# Rndr-AI / indiiOS Gold Master Log

**Status:** STABLE / MULTI-TENANT ENABLED
**Version:** 1.1.0 (Alpha)
**Date:** 2025-12-01
**Deployment:** [https://indiios-v-1-1.web.app](https://indiios-v-1-1.web.app)

## 1. Core Architecture: Multi-Tenancy

The application has been upgraded to a full multi-tenant architecture.

* **Organization Context:** All data (Projects, History, Assets) is now scoped to an `Organization`.
* **Data Hierarchy:** `Organization` -> `Project` -> `Asset`.
* **Service Layer:**
  * `OrganizationService`: Manages org switching and member access.
  * `ProjectService`: Handles project CRUD operations scoped to the active org.
* **Organization Context:** All data (Projects, History, Assets) is now scoped to an `Organization`.
* **Data Hierarchy:** `Organization` -> `Project` -> `Asset`.
* **Service Layer:**
  * `OrganizationService`: Manages org switching and member access.
  * `ProjectService`: Handles project CRUD operations scoped to the active org.
  * `AgentService`: Injects `currentOrganizationId` into the AI context for all agents.
* **State Management:**
  * `AuthSlice`: Manages the current user's active organization.
  * `AppSlice`: Manages the active project within that organization.
  * `CreativeSlice`: Automatically tags generated assets with the active `orgId`.

## 2. Agent System (Hybrid Architecture)

The AI system is a hybrid model combining client-side responsiveness with server-side power.

### A. Client-Side Agents (The "Hub")

* **Manager:** `AgentService` (The "Generalist" / "Agent Zero").
  * **Role:** Triage, Strategy, and Delegation.
  * **Protocol:** "Agent0 Evolution Protocol" (Mode A: Curriculum/Strategy, Mode B: Execution).
* **Specialists:**
  * `LegalAgent`: Contracts, Rights Management, Compliance.
  * `MarketingAgent`: Campaign Strategy, Copywriting.
  * `MusicAgent`: Audio Synthesis, Theory.

### B. Server-Side Agents (The "Heavy Lifters")

* **Framework:** `@mastra/core` running on Firebase Cloud Functions.
* **Creative Director:**
  * **Role:** High-fidelity asset generation oversight.
  * **Tools:** `imageTool` (Gemini 3 Pro Image), Video Treatment generation.
  * **Access:** Exposed via `creativeDirectorAgent` HTTP function.

### C. Tooling

* **Registry:** Client-side agents share a `TOOL_REGISTRY`.
* **Execution:** Tools are executed via strict JSON function calling.

## 3. Frontend Experience

* **Tech Stack:** React Three Fiber, PixiJS v8 (for 2D overlays), Framer Motion.
* **Studio App:**
  * **Modules:** Creative (Image/Video), Music, Marketing, Legal, Workflow, Dashboard.
  * **Navigation:** Context-aware sidebar and command bar.
  * **Theme:** "Surface" dark mode with neon accents (Blue, Purple, Green).

## 4. Backend & Infrastructure

* **Platform:** Firebase (Hosting, Firestore, Storage, Functions).
* **AI Models:**
  * **Text/Reasoning:** Gemini 3.0 Pro (High Thinking).
  * **Image/Video:** Veo 3.1 / Imagen 3 (via ImageService).
* **Deployment:**
  * `landing`: Deployed to `indiios-v-1-1.web.app`.
  * `app`: Deployed to `indiios-studio.web.app`.

## 5. Critical Configuration Rules

### Viewport & Layout

* **Mobile:** `viewport-fit=cover`, `user-scalable=no`.
* **Root:** `html { width: 100%; overflow-x: hidden; }`.
* **Z-Index:** Landing page overlays must use explicit `z-index` to avoid stacking context issues.

### Agent Protocol

* **Streaming:** Agents must support streaming responses for immediate user feedback.
* **Context:** Every agent execution **MUST** include `orgId` and `projectId` in the prompt context.

## 6. RAG & Knowledge Base

* **Service:** `GeminiRetrievalService` (Semantic Retriever API).
* **Architecture:**
  * **Frontend:** Uses `fetch` to call Gemini API directly (via `v1beta`).
  * **CORS Issue:** Direct calls from browser are blocked by CORS.
  * **Proxy Solution:** A local proxy server (`scripts/start-proxy.ts`) is provided for development.
* **Configuration:**
  * Set `VITE_RAG_PROXY_URL=http://localhost:3001` in `.env` to use the proxy.
  * Run `npx tsx scripts/start-proxy.ts` to start the proxy.
* **Status:**
  * `createCorpus`: Working.
  * `createDocument`: Currently returning 404 (API configuration issue under investigation).
  * `generateContent`: Working (using `gemini-flash-latest`).

---
*This document serves as the source of truth for the indiiOS application state.*
