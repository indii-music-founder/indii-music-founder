<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# indiiOS: The AI-Native Creative Studio

indiiOS is a comprehensive, multi-tenant creative platform powered by a multi-agent AI system. It unifies image generation, video production, music synthesis, and campaign management into a single, intelligent workspace.

## 🚀 Live Demo

- **Landing Page:** [https://indiios-v-1-1.web.app](https://indiios-v-1-1.web.app)
- **Studio App:** [https://indiios-studio.web.app](https://indiios-studio.web.app)

## 📚 Documentation

- [Features](./features.md) - Detailed breakdown of current capabilities.
- [Roadmap](./ROADMAP.md) - Future plans and technical improvements.
- [Agent System Architecture](./docs/AGENT_SYSTEM_ARCHITECTURE.md) - Deep dive into the "Hub-and-Spoke" AI model.
- [Backend Architecture](./docs/BACKEND_ARCHITECTURE.md) - Cloud Functions and Vertex AI integration.
- [UI State & Branding](./docs/UI_STATE.md) - Design system and branding guidelines.

## ✨ Key Features

### 🏢 Multi-Tenancy & Collaboration

- **Organization Support:** Create and manage multiple organizations (workspaces).
- **Project Isolation:** Data (Assets, History, Context) is strictly scoped to the active Organization and Project.
- **Cloud Persistence:** All data is securely stored and synced via Firebase Firestore.

### 🤖 The Multi-Agent System ("Hub-and-Spoke")

- **indii (Agent Zero):** The Generalist Manager that triages requests and orchestrates workflows.
- **Specialist Agents:**
  - **LegalAgent:** Contract review, rights management, and compliance.
  - **MarketingAgent:** Campaign strategy, copywriting, and brand alignment.
  - **BrandAgent:** Brand consistency analysis and asset generation.
  - **RoadManager:** Tour logistics, fuel calculations, and itinerary planning.
  - **MusicAgent:** Audio synthesis theory and composition.
- **Context Awareness:** Agents are aware of your current Organization, Project, and Brand Kit.

### 🎨 Creative Suites

- **Creative Studio:** Infinite canvas for image generation, editing, and product visualization ("Showroom").
- **Video Studio:** AI-powered video production workflow (Idea -> Brief -> Review) with "Director's Cut" QA.
- **Music Studio:** Audio analysis and generation tools.
- **Workflow Lab:** Node-based automation editor for chaining AI tasks.

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, TailwindCSS, Framer Motion, React Three Fiber, PixiJS v8.
- **Backend:** Firebase (Hosting, Functions, Firestore, Storage).
- **AI Core:** Google Gemini 3.0 Pro (High Thinking), Veo 3.1, Imagen 3.

## 💻 Run Locally

**Prerequisites:** Node.js 20+, Firebase CLI.

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Environment Setup:**
   Create a `.env.local` file with your keys:

   ```env
   VITE_GEMINI_API_KEY=your_key_here
   VITE_FIREBASE_CONFIG=your_firebase_config_json
   ```

3. **Run the Development Server:**

   ```bash
   npm run dev
   ```

4. **Deploy:**

   ```bash
   firebase deploy
   ```
