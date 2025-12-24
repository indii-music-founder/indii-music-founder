<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# indiiOS: The AI-Native Creative Studio

indiiOS is a multi-tenant creative operating system that blends AI-assisted image generation, video production, music synthesis, and campaign operations into one workspace. The platform is anchored by a hub-and-spoke agent architecture that keeps context (organization, project, brand kit) consistent across every surface.

## 📦 What's in this repo?

- **Landing page** (`landing-page/`): marketing site built with React + Framer Motion that routes into live demos.
- **Web studio** (`src/`, `public/`): the primary React 19 experience containing creative suites, workflow tools, and agent chat.
- **Electron shell** (`electron/`, `dist-electron/`): desktop wrapper that mirrors the studio with native menus and window controls.
- **Agent definitions** (`agents/`): hub + specialist agents, tool definitions, and prompts.
- **Backend services** (`functions/`): Firebase Functions fronting Vertex AI for heavy image/video generation and other workloads.

## ✨ Core experiences

- **Creative Studio:** infinite canvas for image generation, editing, and product visualization ("Showroom").
- **Video Studio:** idea-to-brief-to-render pipeline with QA checkpoints ("Director's Cut").
- **Music Analysis:** audio analysis tools (BPM, key, energy) powered by the MusicAgent.
- **Workflow Lab:** node-based automation editor to chain AI tasks across suites.
- **Operational suites:** marketing, legal, touring, finance, and social modules that keep campaigns on track.

## 🧠 Agent system

- **Hub (indii):** orchestrates conversations, injects org/project context, and delegates to specialists.
- **Specialists:** Legal, Marketing, Brand, Road, Music, Video, Creative Director, and more, each with localized tools/prompts under `agents/<name>/`.
- **Context safety:** Firestore-scoped lookups and prompt guards ensure responses stay within the active workspace.

## 🏗️ Architecture snapshot

- **Frontend:** React 19, Vite, TailwindCSS, Framer Motion, React Three Fiber, PixiJS v8.
- **Backend:** Firebase Hosting/Functions/Firestore/Storage with IAM-gated callable/HTTP endpoints.
- **AI models:** Google Gemini 3.0 (Pro/Flash), Veo 3.1, Gemini 3.0 Pro Image (Nano Banana Pro) for media generation.

## 🚦 Quick start

**Prerequisites:** Node.js 20+, Firebase CLI, access to Google Vertex AI.

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure environment
   Create `.env.local` at the repo root:

   ```env
   VITE_GEMINI_API_KEY=your_key_here
   VITE_FIREBASE_CONFIG=your_firebase_config_json
   ```

3. Run the web studio

   ```bash
   npm run dev
   ```

4. Launch Electron shell

   ```bash
   npm run electron
   ```

5. Deploy (hosting + functions)

   ```bash
   firebase deploy
   ```

## 🧪 Testing & verification

- **Unit/integration:** use the existing test suite and utilities under `src/` (see `package.json` scripts).
- **E2E:** Playwright specs live in `e2e/`.
- **Logs & baselines:** previous verification outputs are captured in `verification/` and `test_results*.txt`.

## 📚 Documentation

- [Features](./features.md) — capabilities overview.
- [Roadmap](./ROADMAP.md) — upcoming work and technical debt.
- [Agent System Architecture](./docs/AGENT_SYSTEM_ARCHITECTURE.md) — hub-and-spoke design and tool calling.
- [Backend Architecture](./docs/BACKEND_ARCHITECTURE.md) — Firebase + Vertex AI service map.
- [Application & Code Overview](./docs/APP_OVERVIEW.md) — how product surfaces map to the codebase.
- [UI State & Branding](./docs/UI_STATE.md) — design system and brand guardrails.

## 📬 Feedback

Issues and improvement ideas are welcome. Please open a GitHub issue or start a thread in the project discussion board.
