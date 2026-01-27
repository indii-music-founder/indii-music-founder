# Tool: indii_oracle

Use this tool to evaluate media assets (images or videos) against project objectives and brand style guides.

**Workflow Integration:**

1. After generating an asset with `indii_image_gen` or `indii_video_gen`, call `indii_oracle` to get an Aesthetic Score and Relative Information Gain (RIG) metric.
2. Use the Oracle's refinement suggestions to guide follow-up "Frontier Tasks" or prompt iterations.

## Usage Example

```json
{
  "tool_name": "indii_oracle",
  "tool_args": {
    "asset_path": "/a0/usr/projects/proj_123/assets/image/gen_172123456.png",
    "context": "Cyberpunk jazz club aesthetic, neon indigo palette"
  }
}
```

## Arguments

- **asset_path** (string, required): Absolute path to the asset to evaluate.
- **context** (string, optional): The creative intent or brand context for comparison.
