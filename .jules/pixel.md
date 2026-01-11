## 2024-05-23 - [Pixel Initialization]
**Learning:** This journal tracks critical learnings for UI/UX testing.
**Action:** Always check here before starting a new test to avoid past pitfalls.

## 2024-05-23 - [Markdown Text Extraction]
**Learning:** When using `react-markdown` with custom components (like `p`), child content is already parsed into React Elements (e.g., `<a>` for URLs). `String(children)` results in `[object Object]`, breaking regex matching for tool outputs.
**Action:** Always use a recursive `getText` helper to reconstruct the raw text string from the React node tree before applying regex patterns.
