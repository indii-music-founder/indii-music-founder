# GOLD MASTER LOG

**Project:** indiiOS (formerly Architexture AI / Rndr-AI)
**Version:** 0.0.1 (Alpha)
**Date:** December 3, 2025
**Status:** Beta Candidate - Feature Complete

---

## 1. Project Overview

**indiiOS** is an AI-native operating system for creative independence. It combines a local-first desktop environment (Electron) with powerful cloud-based AI agents (Firebase/Vertex AI) to empower users to create, manage, and monetize their work.

### Core Philosophy

* **Local-First:** User data lives on their device (IndexedDB/FileSystem). Cloud is for sync and collaboration.
* **Agent-Centric:** "Hub-and-Spoke" architecture where a central Orchestrator delegates to specialist agents.
* **Privacy-Focused:** Secure context, explicit permissions for AI actions.

---

## 2. Technical Architecture

### Tech Stack

* **Runtime:** Electron (Desktop), React/Vite (Renderer)
* **Language:** TypeScript
* **Styling:** Tailwind CSS v4 (CSS-first configuration)
* **State Management:** Zustand (with specialized slices)
* **Local Database:** IndexedDB (`idb`)
* **Backend/Cloud:** Firebase (Auth, Firestore, Functions), Google Vertex AI (Gemini 1.5 Pro, Veo, Imagen 3)
* **Event Bus:** Inngest (Durable Workflows)
* **Creative Tools:** Fabric.js (Image Editor), FFmpeg.wasm (Video Processing), Tone.js (Audio)

### Directory Structure

* `electron/`: Main process and preload scripts.
* `src/core/`: Core system logic (Store, Auth, App State).
* `src/modules/`: Feature modules (Creative, Music, Legal, Marketing, Touring, etc.).
* `src/services/`: Service layer (AI, Database, File System).
* `src/inngest/`: Background job definitions.
* `functions/`: Firebase Cloud Functions.

---

## 3. Recent Updates & Features

### AI Agent Ecosystem

* **Creative Director:** Visionary agent for video/image generation and refinement.
* **Campaign Manager:** Orchestrates multi-channel marketing campaigns.
* **Brand Manager:** Enforces brand consistency and generates assets.
* **Road Manager:** Handles tour planning, logistics, and itinerary generation.

### New Modules & Features

* **Creative Studio:**
  * **Magic Fill:** AI inpainting using Fabric.js masking and Imagen 3.
  * **Video Pipeline:** Durable video generation using Inngest.
* **Music Studio:**
  * **Tone.js Integration:** Real-time audio synthesis.
  * **Audio Analysis Engine:** Client-side analysis of BPM, Key, Energy.
* **Marketing Dashboard:** Campaign calendar, asset management, and brand guidelines.
* **Legal Dashboard:** Contract analysis and risk assessment.
* **Touring Module:** Itinerary management and logistics checking.

### Engineering & Quality

* **Testing:**
  * **Unit Tests:** Comprehensive coverage for Services and Components (Vitest).
  * **E2E Tests:** Electron IPC verification (Playwright).
  * **Stress Testing:** Validated system stability under load (k6, Playwright).
* **Performance:**
  * **Frontend:** Optimized rendering (60fps) and asset loading (<500ms).
  * **Backend:** Verified <1% error rate at 50 concurrent users.
* **CI/CD:** Automated build and test pipelines via GitHub Actions.
  * **Governance:** Strict adherence to rules defined in `agent.md` (e.g., Two-Strike Pivot, Service/UI Split).

---

## 4. Known Issues & Next Steps

* **Next Steps:**
    1. Beta Release to early adopters.
    2. Expand "Knowledge Base" with RAG integration.
    3. Refine mobile experience for companion app.

---

## 5. Confirmed Baseline (Dec 10, 2025)

**DO NOT REGRESS THE FOLLOWING FEATURES.**
These features have been verified working in production-like conditions via Live Demo and Testing.

### A. Onboarding & Identity

1. **Full Flow Functionality**: Users can travel from **Landing Page (Login)** -> **Onboarding (Chat)** -> **Dashboard (Studio)** without interruption.
    * *Verified by*: Live Demo "Kaelen V"
2. **Client-Side Generative UI**: The Onboarding Agent **MUST** be able to render interactive buttons (Generative UI) for high-friction questions (Genre, Career Stage, Goals).
    * *Implementation*: `askMultipleChoice` tool in `onboardingService.ts`.
    * *Renderer*: `OnboardingPage.tsx` handles `msg.toolCall` logic.
    * *Verified by*: `src/modules/onboarding/pages/OnboardingPage.test.tsx` (Unit) and Live Browser Verification.
3. **Agent Persona Persistence**: The Agent must maintain a specific creative persona (e.g., "Kaelen V") and not revert to a generic robotic assistant.
    * *Verified by*: Persistent memory checks in "The Gauntlet".

### B. Core Architecture

1. **Local-First Profile**: User profile data (bio, genre, goals) successfully saves to the local store and persists between sessions.
2. **Auth State Transitions**: The app correctly handles the state change from `New User` -> `Onboarding` -> `Authenticated User`.

**Evidence:**
* [Demo Recording](/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/cc7a8891-6e3e-4de3-a1ad-8cdf2036c396/onboarding_kaelen_v_1765428994412.webp)
* [Unit Test](/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/src/modules/onboarding/pages/OnboardingPage.test.tsx)
