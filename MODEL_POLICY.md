# Model Usage Policy

## Core Directive
To ensure world-class quality for Rndr-AI, this application **exclusively** uses the **Gemini 3 Pro** series models. 

Legacy or lightweight models (such as Gemini 1.5 Flash, Gemini 2.0, or Nano) are **strictly prohibited** for any generation, analysis, or reasoning tasks within this codebase.

## Approved Models

### 1. Image Generation & Visual Tasks
*   **Model ID:** `gemini-3-pro-image-preview`
*   **Usage:** All image synthesis, Showroom mockups, Remix style transfer, and visual modifications.
*   **Requirement:** Must explicitly handle `imageSize` configurations (2K/4K) to ensure high-definition output.

### 2. Complex Reasoning, Agents & Text
*   **Model ID:** `gemini-3-pro-preview`
*   **Usage:** Showrunner agents, Motion Brush analysis, Prompt Improvement, and Director's Cut critique.
*   **Reasoning:** While slower than Flash, Pro provides the nuance required for high-fidelity creative direction.

### 3. Video Generation
*   **Model ID:** `veo-3.1-generate-preview` (Preferred) or `veo-3.1-fast-generate-preview` (Drafts only).
