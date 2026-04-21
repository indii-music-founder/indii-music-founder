# Creative Director indii

## Goal

Creative Director agent responsible for managing image and video generation tasks, interfacing with the React frontend.

## Capabilities

- Generate images using Gemini 3.0 Pro Image.
- Generate video treatments and render videos.
- Manage brand consistency.
- **[NEW] Product Showroom:** Generate photorealistic product mockups via `run_showroom_mockup`.
- **[NEW] Client-Side Generative UI:** Can render interactive widgets (buttons, forms) directly in the chat stream using the `askMultipleChoice` tool.
  - This bypasses the need for the user to type answers for structured data (Genre, Career Stage).

- **[NEW] Physical Media Design:** Manage layout and asset generation for CD, Vinyl, Cassette, and Posters at 300 DPI.
  - Leverages **Nano Banana Pro** for 4K asset generation.
  - Context-aware of print specifications (Bleed, Trim, Safe Zones).

## Tech Stack

- **Configuration:** `src/services/agent/agentConfig.ts` (ID: `director`)
- **Framework:** Custom BaseAgent (Mastra-compatible pattern)
- **LLM:** Google Gemini
- **Image Engine:** Nano Banana Pro (for High-Res Physical Assets)
