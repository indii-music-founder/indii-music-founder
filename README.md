<div align="center">
  <img width="1200" height="475" alt="indiiOS Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# indiiOS: The Sovereign Creative Engine

**The First AI-Native Operating System for Independent Artists & Producers.**

indiiOS is not just a platform; it is a **Digital Handshake**. It is a multi-tenant, sovereign creative workspace designed to empower independent music producers, visual artists, and labels. By unifying AI-powered asset generation, automated distribution, and intelligent business operations, indiiOS enables creators to own their infrastructure, their data, and their future.

[![Version](https://img.shields.io/badge/Version-0.1.0--beta.2-blue)](https://github.com/the-walking-agency-det/indiiOS-Alpha-Electron)
[![Firebase](https://img.shields.io/badge/Cloud-Firebase-FFCA28?logo=firebase)](https://indiios-studio.web.app)
[![React](https://img.shields.io/badge/Framework-React_18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Electron](https://img.shields.io/badge/Desktop-Electron_33-47848F?logo=electron)](https://www.electronjs.org)

---

## 💠 The Vision

indiiOS solves the "fragmentation trap" where artists lose 40% of their creative time managing 20+ different tools. It provides a unified **Neural Cortex** that understands your brand, your sound, and your business goals across every module.

---

## 🏗️ 3-Layer Architecture

To ensure 99.9% reliability in probabilistic AI workflows, indiiOS operates on a rigorous 3-layer system:

1.  **Layer 1: Directive (Managerial)** - Natural language SOPs (Standard Operating Procedures) that define goals and safety boundaries.
2.  **Layer 2: Orchestration (Intelligence)** - The Hub-and-Spoke Agent system (indii) that reasons, routes tasks, and manages context.
3.  **Layer 3: Execution (Deterministic)** - Hard-coded TypeScript and Python scripts that handle the "heavy lifting" (API calls, file system ops, DDEX generation).

---

## 🤖 indii: The Hub-and-Spoke Agent System

The core of indiiOS is **indii**, an intelligent orchestration hub.

-   **Agent Zero (The Hub):** The central brain. It maintains your session context and coordinates between specialist agents.
-   **Specialist Agents (The Spokes):**
    -   **Legal Agent:** Real-time contract review and rights management.
    -   **Creative Director:** Maintains brand consistency across image and video generation.
    -   **Music Agent:** Deep audio analysis (BPM, key, timbre) via `Essentia.js`.
    -   **Marketing Agent:** Automated campaign execution and AI copywriting.
    -   **Finance Agent:** Waterfall payout calculations and royalty tracking.
    -   **Browser Agent:** Autonomous Puppeteer driver for real-time web discovery.

---

## 📦 Core Modules

### 🎨 Creative Studios
*   **Creative Studio:** An infinite Fabric.js canvas for AI image generation, product visualization, and asset editing.
*   **Video Studio:** A production-grade pipeline for **Veo 3.1** and **Imagen** video synthesis, featuring a built-in "Director's Cut" QA step.
*   **Workflow Lab:** A node-based automation editor (React Flow) to chain complex AI tasks into repeatable creative recipes.

### 📈 Business Operations
*   **Distribution & DDEX:** The industry-standard **DDEX (Digital Data Exchange)** engine. Automated generation of ERN (Electronic Release Notification) messages and parsing of DSR (Digital Sales Report) files.
*   **Finance & Royalties:** A secure ledger for tracking streaming revenue, physical sales, and automated royalty splits.
*   **Touring (Road Manager):** Logistics, fuel calculations, and venue discovery for independent touring.

---

## 🚀 Tech Stack

### Frontend & Desktop
- **UI:** React 18, Vite, TailwindCSS v4 (CSS-first)
- **State:** Zustand 5.0 (Slice-based)
- **Desktop:** Electron 33 (Hardened sandbox, Context Isolation)
- **Animation:** Framer Motion 12.x

### Backend & AI
- **Cloud:** Firebase (Gen 2 Functions, Firestore, Storage)
- **AI Models:** Gemini 3 Pro (Complex Reasoning), Gemini 3 Flash (Fast Routing), Veo 3.1 (Video), Imagen (Image)
- **Jobs:** Inngest 3.46 (Reliable background task orchestration)
- **Security:** R2A2 (Reflective Risk-Awareness) scanning for prompt injections.

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js:** >= 22.0.0
- **Firebase CLI:** `npm install -g firebase-tools`
- **Docker:** (Optional) Required for Agent Zero Sidecar execution.

### Installation
```bash
git clone https://github.com/the-walking-agency-det/indiiOS-Alpha-Electron.git
cd indiiOS-Alpha-Electron
npm install
```

### Environment Setup
Copy `.env.example` to `.env` and provide your API keys:
- `VITE_API_KEY`: Your Gemini/Google AI key.
- `VITE_FIREBASE_API_KEY`: Your Firebase project identifier.

### Development
```bash
# Start Vite Studio (Port 4242)
npm run dev

# Start Electron App (Requires Vite running)
npm run desktop:dev
```

---

## 🧪 Testing & Quality
indiiOS maintains a **"Zero-Regression"** policy.
- **Unit:** Vitest (jsdom environment).
- **E2E:** Playwright (60+ critical path specs).
- **Security:** Strict API Credentials Policy and automated secret scanning.

---

## 📜 Documentation
For deep-dives into specific subsystems, see:
- [Architecture Standard](directives/architecture_standard.md)
- [Agent Stability Protocol](directives/agent_stability.md)
- [DDEX Implementation Plan](docs/DDEX_IMPLEMENTATION_PLAN.md)
- [Model Usage Policy](MODEL_POLICY.md)

---

## ⚖️ License
Proprietary. © 2026 IndiiOS LLC. All Rights Reserved.

<div align="center">
  <sub>Built by Artists, for Artists. Powered by High-Intelligence.</sub>
</div>
