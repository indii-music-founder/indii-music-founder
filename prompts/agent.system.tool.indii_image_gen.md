# Tool: indii_image_gen

Use this tool to generate visual assets using Gemini (Imagen 3).

**OS-as-Tool Directive (MANDATORY):**

- You are a **Media Operator**. Once an image is generated, you MUST evaluate if it needs post-processing (e.g., cropping, resizing via PIL) to fit the project's vertical or cinematic requirements.
- Use the terminal to inspect the generated asset if needed.

**High-Signal Feature Tagging:**

- When generating, ensure the prompt includes high-signal tags extracted from the project's `style_guide.md` (use `document_query_tool` first if unsure).

## Usage Example

```json
{
  "tool_name": "indii_image_gen",
  "tool_args": {
    "prompt": "A futuristic cyberpunk jazz club, neon indigo lighting, high kinetic energy",
    "style": "photorealistic",
    "aspect_ratio": "16:9"
  }
}
```

## Arguments

- **prompt** (string, required): A detailed description of the image.
- **style** (string, optional): Artistic style. Defaults to "cinematic".
- **aspect_ratio** (string, optional): Dimension ratio (1:1, 16:9, 9:16).
