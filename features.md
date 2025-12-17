# indiiOS Feature Roadmap

## Phase 1: Completed Core Features (The Studio Suite)

### 1. Architecture & Infrastructure

* **Multi-Tenancy:** Full support for Organizations and Workspaces.
* **Cloud Persistence:** Firebase Firestore integration for syncing Projects, History, and Assets.
* **Project Isolation:** Strict data segregation between Organizations and Projects.
* **Mobile Optimization:** Haptic feedback, touch-optimized controls, and responsive layout (iOS/Android).

### 2. The Multi-Agent System

* **Hub-and-Spoke Architecture:** Central "Generalist" agent delegating to specialized sub-agents.
* **Specialist Agents:**
  * **LegalAgent:** Contract analysis and risk assessment.
  * **MarketingAgent:** Campaign generation and brand voice alignment.
  * **BrandAgent:** Brand consistency analysis and asset generation.
  * **RoadManager:** Tour logistics, fuel calculations, and itinerary planning.
  * **MusicAgent:** Audio theory and composition assistance.
* **Server-Side Agents (Mastra):** "Creative Director" agent running on Cloud Functions for high-fidelity asset generation.
* **Context Injection:** Agents automatically receive Organization, Project, and Brand Kit context.
* **Streaming Responses:** Real-time token streaming for immediate feedback.

### 3. Video Production

* **The Infinite Reel:** Automated Daisy-Chaining for long-form video generation.
* **Keyframe In-Betweening:** Morphing transitions between Start and End frames.
* **Motion Brush:** Paint-to-Animate interface for targeted motion control.
* **Audio-Synced Pacing:** Music Video generation based on rhythm analysis.
* **Export Reel:** Client-side stitching of video clips into a single movie file.

### 4. Image & Asset Creation

* **The Infinite Canvas:** Spatial workspace with Context-Aware Outpainting (Shift+Drag).
* **The Remix Engine:** Style Transfer separating "Content" from "Style".
* **Product Showroom:** Photorealistic product visualization and animation from flat assets.
* **Film Strip:** Horizontal timeline for quick access and Daisy-Chain context selection.

### 5. Workflow & Intelligence

* **The Show Bible:** Project-level context manager (Anchors, Rules, Settings).
* **Character Anchor:** Identity preservation using reference assets.
* **The Director's Board:** Agent-driven storyboard generation (Pre-visualization).
* **Director's Cut:** Automated QA loop where an Agent critiques and rejects low-quality outputs.
* **Prompt Improver:** Expert system to expand simple prompts into cinematic directives.
* **RAG / Knowledge Base:** Semantic retrieval system for project documents and assets (Beta).

---

## Phase 2: Future Enhancements

### 1. The Neural Cortex (Advanced Logic)

* **Semantic Visual Memory Core:** A vector-based imagination system for indii. Instead of just referencing pixels, the Agent
  understands the *narrative intent* and *semantic identity* of characters/locations to eliminate visual drift during long
 add-semantic-visual-memory-core2025-12-1702-24-52
  Story Chains. See the [Neural Cortex spec](docs/NEURAL_CORTEX.md) for the semantic memory architecture, interfaces, drift
  detection loop, expanded runbooks (health/back-pressure/degraded modes), contract exemplars with QA harnesses, telemetry-led
  staging, and Phase 2 operational hardening with performance budgets and staged rollout.

  Story Chains. See the [Neural Cortex spec](docs/NEURAL_CORTEX.md) for the semantic memory architecture, interfaces, and drift
  detection loop.
 main
* **Team Collaboration:** Real-time multiplayer editing within a Project.

### 2. 3D & Spatial

* **3D Model Import:** Using GLB files as reference for composition in Showroom/Canvas.

### 3. Voice Control

* **Audio-In Prompts:** Using Gemini Live API to describe scenes via voice while drawing on the canvas.
