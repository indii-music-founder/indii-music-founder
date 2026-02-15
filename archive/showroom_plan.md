# Feature Specification: The Product Showroom

## 1. Overview
The **Product Showroom** is a new orchestration mode designed to transform flat 2D assets (logos, graphics, UI designs) into photorealistic 3D product demonstrations (images and videos). It solves the problem of "Visualizing the End Product" by orchestrating Gemini 3 Pro (for compositing) and Veo 3.1 (for demonstration).

## 2. User Story
As a designer or marketer, I want to upload a raw `.png` of my T-shirt graphic and describe a scenario (e.g., "A model walking through Tokyo at night"), so that I can generate a realistic video of my product in action without physical prototyping.

## 3. Technical Architecture

The feature runs on a two-stage "Mockup & Move" pipeline:

### Stage 1: The Virtual Compositor (Image Generation)
*   **Model:** `gemini-3-pro-image-preview`
*   **Input:** 
    1.  **Product Asset:** The user's uploaded graphic.
    2.  **Context Prompt:** The user's description of the scene.
    3.  **Product Topology:** The type of object (T-Shirt, Hoodie, Coffee Mug, etc.).
*   **Prompt Engineering Strategy:**
    *   We do not just ask for an image; we explicitly instruct the model to perform a *texture mapping* task.
    *   *System Instruction:* "You are a product visualizer. You will be provided with a graphic design asset. Your task is to generate a photorealistic image of the described scene. Crucially, you must apply the provided graphic design onto the [PRODUCT_TYPE] in the scene. The graphic must conform to the geometry, fabric folds, lighting, and texture of the object."

### Stage 2: The Demo Director (Video Generation)
*   **Model:** `veo-3.1-generate-preview`
*   **Input:**
    1.  **Source Image:** The result from Stage 1 (The Composite).
    2.  **Motion Prompt:** A description of how the subject or camera should move.
*   **Configuration:**
    *   Use `image` input to lock the visual consistency.
    *   Resolution: 720p or 1080p.

## 4. UI/UX Design

### New Mode: `Showroom`
A dedicated workspace accessed via the main mode selector.

### Layout
The interface is split into three columns:

**Column 1: The Asset (Input)**
*   **Asset Dropzone:** Specialized for PNGs with transparency.
*   **Product Type Selector:** Dropdown [T-Shirt, Hoodie, Mug, Bottle, Poster, Phone Screen].
*   **Placement Hints:** [Center Chest, Pocket, Full Print, etc.] (Optional metadata for the prompt).

**Column 2: The Scenario (Context)**
*   **Scene Description:** "A streetwear model leaning against a brick wall."
*   **Motion Description:** "Slow camera pan, model looks at camera."
*   **Presets:** Quick-select buttons for common scenarios (e.g., "Runway", "Studio Minimal", "Urban").

**Column 3: The Stage (Output)**
*   **Preview Monitor:** Displays the Stage 1 Mockup first.
*   **Action Buttons:**
    *   `📸 Generate Mockup` (Costs low compute/time).
    *   `🎬 Animate Scene` (Only active after Mockup is generated).

## 5. Implementation Steps

1.  **State Management:**
    *   Add `showroom` to `OperationMode`.
    *   Add `productAsset` state to track the specific image being utilized for the mockup.

2.  **UI Construction:**
    *   Build the `showroom-ui` container (hidden by default).
    *   Create the "Asset Rack" (Product Type selector + Dropzone).

3.  **Logic Implementation:**
    *   `runShowroomMockup()`: Orchestrates the call to `gemini-3-pro-image-preview` with the specific texture-mapping prompt structure.
    *   `runShowroomVideo()`: Takes the `generatedHistory[0]` (the mockup) and pipes it into `veo-3.1`.

4.  **Refinement:**
    *   Ensure the prompt correctly separates the "Graphic" from the "Scene".
    *   Add error handling if the model fails to apply the graphic (e.g., if the graphic is too complex or the prompt is ambiguous).
