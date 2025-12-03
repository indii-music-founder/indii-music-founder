# Creative Module

## Purpose

The Creative Module is the central hub for visual content generation and editing within indiiOS. It provides tools for generating images and videos using advanced AI models (Gemini, Vertex AI), as well as a canvas for editing and refining assets.

## Key Components

### `CreativeNavbar`

The main navigation and control bar for the creative studio. It handles:

- Prompt input and management.
- Mode switching (Image vs. Video).
- Daisy-chaining video generation.
- Access to brand assets and history.

### `CreativeCanvas`

An interactive canvas based on `fabric.js` that allows users to:

- View generated images and videos.
- Edit images using drawing tools.
- Apply "Magic Fill" (inpainting) to specific areas.
- Add shapes and text.

### `PromptTools`

A set of utilities to enhance user prompts:

- **Magic Words:** Adds artistic adjectives to the prompt.
- **Prompt Improver:** Uses AI to rewrite and expand the prompt into a detailed visual script.

### `StudioNavControls`

Provides fine-grained control over generation parameters:

- Aspect Ratio.
- Resolution.
- Negative Prompts.
- Seed control.

## Services Used

- `ImageGenerationService`: Handles image generation requests.
- `VideoGenerationService`: Manages video generation, including "Daisy Chain" functionality.
- `EditingService`: Powers the "Magic Fill" and other editing capabilities.
