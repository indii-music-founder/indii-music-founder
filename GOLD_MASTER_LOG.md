# GOLD MASTER LOG

**Project:** indiiOS (formerly Architexture AI / Rndr-AI)
**Version:** 0.0.1 (Alpha)
**Date:** December 1, 2025
**Status:** Active Development - Core Framework Setup

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
* `src/modules/`: Feature modules (Creative, Music, Legal, etc.).
* `src/services/`: Service layer (AI, Database, File System).
* `src/inngest/`: Background job definitions.
* `functions/`: Firebase Cloud Functions.

---

## 3. Recent Updates & Features

### Core Framework

* **Electron Setup:**
  * Configured `tsconfig.electron.json` for ESM output (`NodeNext`).
  * Updated `package.json` scripts for dual-build process (`tsc` + `vite`).
  * Implemented secure IPC bridge (`electronAPI`) for platform info.
  * Fixed path resolution for production builds (`base: './'`).
* **Tailwind CSS v4:**
  * Migrated to `@tailwindcss/vite` plugin.
  * Updated `index.css` to use `@import "tailwindcss";`.
  * Removed legacy `postcss.config.js` and `tailwind.config.js`.
* **Inngest Integration:**
  * Initialized `Inngest` client in `src/inngest/client.ts`.
  * Created `helloWorld` test function.
  * Configured Firebase Functions to serve Inngest handlers.

### Creative Studio ("Deep Dive")

* **Fabric.js Canvas:**
  * Implemented `CreativeCanvas.tsx` using Fabric.js.
  * Features: Image rendering, basic shapes (Rect, Circle), Text, Masking (Brush/Eraser).
  * "Magic Fill" stub for AI inpainting.
  * Export to PNG for video generation.

### Security & Billing

* **API Key Management:**
  * Added `ApiKeyErrorModal` to handle quota/billing issues gracefully.
  * Created `scripts/configure_secrets.sh` for secure env var management.

---

## 4. Known Issues & Next Steps

* **Fabric.js Types:** Minor linting issues with `fabric` types in `CreativeCanvas` (suppressed for now).
* **Electron Squirrel:** `electron-squirrel-startup` requires type suppression in `main.ts`.
* **Next Steps:**
    1. Develop "Creative Director" persona logic.
    2. Connect `CreativeCanvas` export to `VideoService`.
    3. Implement actual "Magic Fill" using Imagen 3 via Inngest.
