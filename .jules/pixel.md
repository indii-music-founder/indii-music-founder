## 2024-05-23 - [Pixel Initialization]
**Learning:** This journal tracks critical learnings for UI/UX testing.
**Action:** Always check here before starting a new test to avoid past pitfalls.

## 2024-05-23 - [Markdown Text Extraction]
**Learning:** When using `react-markdown` with custom components (like `p`), child content is already parsed into React Elements (e.g., `<a>` for URLs). `String(children)` results in `[object Object]`, breaking regex matching for tool outputs.
**Action:** Always use a recursive `getText` helper to reconstruct the raw text string from the React node tree before applying regex patterns.
## 2024-05-23 - [Accessibility Testing with Vitest]
**Learning:** Jest-axe works seamlessly with Vitest when  is used. When testing complex modals, ensuring , , and proper label association (/uid=1001(jules) gid=1001(jules) groups=1001(jules),27(sudo)) is critical for passing  checks.
**Action:** For all future AI modal implementations, start by defining the  role and labelling strategy before writing the component logic.
## 2024-05-23 - [Accessibility Testing with Vitest]
**Learning:** Jest-axe works seamlessly with Vitest when `expect.extend(toHaveNoViolations)` is used. When testing complex modals, ensuring `role="dialog"`, `aria-modal`, and proper label association (`htmlFor`/`id`) is critical for passing `axe` checks.
**Action:** For all future AI modal implementations, start by defining the `dialog` role and labelling strategy before writing the component logic.
