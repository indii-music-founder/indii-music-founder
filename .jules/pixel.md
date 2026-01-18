## 2024-05-23 - [Pixel Initialization]
**Learning:** This journal tracks critical learnings for UI/UX testing.
**Action:** Always check here before starting a new test to avoid past pitfalls.

## 2024-05-23 - [Markdown Text Extraction]
**Learning:** When using `react-markdown` with custom components (like `p`), child content is already parsed into React Elements (e.g., `<a>` for URLs). `String(children)` results in `[object Object]`, breaking regex matching for tool outputs.
**Action:** Always use a recursive `getText` helper to reconstruct the raw text string from the React node tree before applying regex patterns.

## 2024-05-23 - [Accessibility Testing with Vitest]
**Learning:** Jest-axe works seamlessly with Vitest when `expect.extend(toHaveNoViolations)` is used. When testing complex modals, ensuring `role="dialog"`, `aria-modal`, and proper label association (`htmlFor`/`id`) is critical for passing `axe` checks.
**Action:** For all future AI modal implementations, start by defining the `dialog` role and labelling strategy before writing the component logic.

## 2025-02-18 - [Form Label Association]
**Learning:** `screen.getByLabelText` requires explicit association between label and input using `htmlFor` and `id`, or nesting. Visual proximity is not enough for accessibility tools or tests.
**Action:** When creating form inputs, always assign an `id` and link the label via `htmlFor` to ensure accessibility and testability.

## 2025-02-18 - [Streaming & Act Warnings]
**Learning:** When testing components that consume async generators (streams), failing to wait for the stream to fully complete results in 'act(...)' warnings. Also, icon-only buttons MUST have `aria-label` to be selectable by `getByRole` and accessible.
**Action:** Always `await waitFor` the final state of a stream (e.g. the final message or empty loading indicator) before asserting or ending the test.

## 2025-02-18 - [Mixed State Mocking]
**Learning:** When a component relies on both global store state (via hooks like `useStore`) and local state (via `useState`) for the same feature (e.g., loading indicators), mocking the store hook with a static return value prevents re-renders when the "store" updates.
**Action:** If the component triggers a local state update (e.g., `setScanStatus`) alongside the store update, it will force a re-render that reads the new mock store value. Ensure your mock store logic allows modifying the returned value before the component re-renders.
