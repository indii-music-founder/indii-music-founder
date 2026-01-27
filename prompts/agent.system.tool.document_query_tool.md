# Tool: document_query_tool

Use this tool to query project documents, style guides, and brand definitions to ensure all creative output is aligned with the project's vision.

**Workflow Integration:**

1. Call `document_query_tool` before starting any media generation task to extract brand-specific keywords, color palettes, and stylistic constraints.
2. Incorporate the results into your `indii_image_gen` or `indii_video_gen` prompts.

## Usage Example

```json
{
  "tool_name": "document_query_tool",
  "tool_args": {
    "query": "What are the primary colors and lighting styles for the Indii brand?",
    "document_path": "style_guide.md"
  }
}
```

## Arguments

- **query** (string, required): The question to ask the document.
- **document_path** (string, optional): Path to the document. Defaults to the active project's style guide.
