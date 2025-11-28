# Rndr-AI Feature Roadmap

## Phase 1: Completed Core Features (The Studio Suite)

### 1. Video Production
*   **The Infinite Reel:** Automated Daisy-Chaining for long-form video generation.
*   **Keyframe In-Betweening:** Morphing transitions between Start and End frames.
*   **Motion Brush:** Paint-to-Animate interface for targeted motion control.
*   **Audio-Synced Pacing:** Music Video generation based on rhythm analysis.
*   **Export Reel:** Client-side stitching of video clips into a single movie file.

### 2. Image & Asset Creation
*   **The Infinite Canvas:** Spatial workspace with Context-Aware Outpainting (Shift+Drag).
*   **The Remix Engine:** Style Transfer separating "Content" from "Style".
*   **Product Showroom:** Photorealistic product visualization and animation from flat assets.
*   **Film Strip:** Horizontal timeline for quick access and Daisy-Chain context selection.

### 3. Workflow & Intelligence
*   **The Show Bible:** Project-level context manager (Anchors, Rules, Settings).
*   **Character Anchor:** Identity preservation using reference assets.
*   **The Director's Board:** Agent-driven storyboard generation (Pre-visualization).
*   **Director's Cut:** Automated QA loop where an Agent critiques and rejects low-quality outputs.
*   **Prompt Improver:** Expert system to expand simple prompts into cinematic directives.
*   **Agent R (Agent Zero):** Autonomous Studio Manager with ReAct loop, Tool Registry, Personas, and Multimodal Vision.

### 4. Infrastructure
*   **Data Persistence:** IndexedDB integration saving Gallery, History, Prompts, and Canvas layout between sessions.
*   **Project Isolation:** Strict data segregation between projects (Gallery, History, Agent Memory).
*   **Mobile Optimization:** Haptic feedback, touch-optimized controls, and responsive layout.

---

## Phase 2: Future Enhancements

### 1. The Neural Cortex (Advanced Logic)
*   **Semantic Visual Memory Core:** A vector-based imagination system for Agent R. Instead of just referencing pixels, the Agent understands the *narrative intent* and *semantic identity* of characters/locations to eliminate visual drift during long Story Chains.
*   **Cloud Sync:** Moving from Local IndexedDB to Firebase/Supabase for cross-device usage.
*   **Team Projects:** Shared Bibles and Asset libraries.

### 2. 3D & Spatial
*   **3D Model Import:** Using GLB files as reference for composition in Showroom/Canvas.

### 3. Voice Control
*   **Audio-In Prompts:** Using Gemini Live API to describe scenes via voice while drawing on the canvas.