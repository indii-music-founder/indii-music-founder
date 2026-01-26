# indii_image_gen

Generate images using Google's Imagen 3 API.

Generate images using Google's Gemini 3 / Imagen 3 API.
Use this tool when the user asks to create, generate, or visualize an image (album cover, art, etc.).

**Behavioral Rules:**

1. Check `project_knowledge` for branding guidelines before constructing the prompt.
2. Ensure the generation aligns with the user's defined visual style.
3. If no style is provided, ask the user or infer from project context.

Usage:

~~~json
{
    "thoughts": [
        "User wants an album cover.",
        "Checking branding style in project_knowledge...",
        "Style is documented as 'Vibrant Synthwave'."
    ],
    "headline": "Generating Album Art (Vibrant Synthwave)",
    "tool_name": "indii_image_gen",
    "tool_args": {
        "prompt": "Retro futuristic synthesizer in space",
        "style": "Vibrant Synthwave, high contrast, 80s aesthetic",
        "aspect_ratio": "1:1"
    }
}
~~~
