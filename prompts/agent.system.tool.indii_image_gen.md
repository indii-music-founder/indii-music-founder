# Tool: indii_image_gen

Use this tool to generate visual assets for the music project, such as Album Art, Tour Posters, or Social Media visuals.
The tool renders the result directly in the chat interface.

## Usage Example

```json
{
  "tool_name": "indii_image_gen",
  "tool_args": {
    "prompt": "A futuristic cyberpunk jazz club with neon lights",
    "style": "photorealistic",
    "aspect_ratio": "16:9"
  }
}
```

## Arguments

- **prompt** (string, required): A detailed description of the image to generate.
- **style** (string, optional): The artistic style (e.g., "oil painting", "digital art", "minimalist"). Defaults to "cinematic".
- **aspect_ratio** (string, optional): The dimension ratio. Defaults to "1:1".
