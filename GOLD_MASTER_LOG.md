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
  * `AgentService`: Injects `currentOrganizationId` into the AI context for all agents.
* **State Management:**
  * `AuthSlice`: Manages the current user's active organization.
  * `AppSlice`: Manages the active project within that organization.
  * `CreativeSlice`: Automatically tags generated assets with the active `orgId`.

## 2. Agent System (The "Hub-and-Spoke" Model)

The AI system is structured as a multi-agent team orchestrated by a central manager.

* **Manager:** `AgentService` (The "Generalist" / "Agent Zero").
  * **Role:** Triage, Strategy, and Delegation.
  * **Protocol:** "Agent0 Evolution Protocol" (Mode A: Curriculum/Strategy, Mode B: Execution).
* **Specialists:**
  * `LegalAgent`: Contracts, Rights Management, Compliance.
  * `MarketingAgent`: Campaign Strategy, Copywriting.
  * `MusicAgent`: Audio Synthesis, Theory.
* **Tooling:**
  * All agents share a `TOOL_REGISTRY` but have specialized prompts.
  * Tools are executed via strict JSON function calling.

## 3. Frontend Experience

* **Landing Page:**
  * **Visuals:** "Liquid Orbs" (Bubbles) with audio reactivity and scroll-based density.
  * **Security Grid:** 3D "Data Vault" visualization.
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

---
*This document serves as the source of truth for the indiiOS application state.*
