# Nano Banana Pipeline Workflow Map

This document outlines the overarching workflow map for the Nano Banana multi-turn image generation pipeline, integrating the architectural blueprint of the Gemini 3 Image API capabilities.

## 1. The Iteration Loop: Conversational Editing & State
The core mechanism for conversational image manipulation. It relies heavily on preserving the model's spatial reasoning between turns.

*   **Initialization:** User submits a natural language prompt to generate an image.
*   **Response Handling:**
    *   **Visual Save States:** Capture snapshots of the generated image.
    *   **Thought Signature Capture:** Extract the returned `thoughtSignature`. This acts as an *encrypted reasoning snapshot*, allowing the model to recall spatial arrangements, lighting, and object persistence across turns.
    *   **Thought Summaries:** (Optional) Capture for transparency on the model's internal processing.
*   **Follow-up Requests (Multi-Turn):**
    *   **Mandatory Handling:** You MUST pass the previous `thoughtSignature` alongside the new prompt to avoid a `400 Invalid Argument Error`.
    *   **Emergency Fallback:** Use `"context_engineering_is_the_way_to_go"` if the signature is lost or to bypass legacy logging restrictions.

## 2. Orchestration: The Entry Layer
Settings configured prior to generation to define constraints and capabilities.

*   **Tiered Model Selection:**
    *   **Nano Banana Pro:** Pro-level intelligence for complex text/reasoning. Best for professional, high-fidelity combinations.
    *   **Nano Banana 2:** High speed/efficiency.
    *   **Gemini 2.5 Flash:** Low latency standard.
*   **Configurable Thinking Levels:** Adjust to balance cost and complexity (Minimal, Low, Medium, High).
*   **Media Resolution Control:** Optimize detailing based on platform surface (0.5K, 1K, 2K, 4K).

## 3. The Creative Workspace: Generation & Grounding
Context and grounding variables that enrich the prompt.

*   **Real-time Search Grounding:** Verify facts, styles, and current locales via Google Search.
*   **Reference Image Tray:** Maximize subject fidelity (up to 14 references).
    *   *Person References (Up to 4):* Maintain identity retention.
    *   *Object References (Up to 10):* Anchor sections and specific styles.
*   **Aspect Ratios:** Native support for 14 dimensional layouts (e.g., 1:1, 16:9, 9:16, 5:1, etc.).

## 4. Precision Editing: Masking & Transformation
Tooling available for targeted manipulation.

*   **Semantic Inpainting:** Define a mask to erase or insert new elements based on the prompt.
*   **Outpainting & Canvas Expansion:** Fluidly expand the boundaries of an existing canvas.
*   **Professional Style Transfer:** Force a specific textural or material style while strictly preserving the underlying subject structure.

---
**Golden Rule:** The `thoughtSignature` is the bridge between human intention and the model's memory. Never drop it during a session.
