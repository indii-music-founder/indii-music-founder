## 2024-05-22 - ChatOverlay Streaming & Focus
**Learning:** Streaming text updates in `aria-live` regions can cause screen readers to re-read the entire content on every character addition if the region is not configured correctly or if the updates are too frequent.
**Action:** Use `aria-live="polite"` on the message container but ensure we don't trigger updates for every character. Alternatively, rely on the user manually checking the message after the "Thinking..." state resolves, or use a dedicated "status" region for the "Thinking" state.

## 2024-05-22 - Collapsible Sections
**Learning:** Custom collapsible sections (like `ThoughtChain`) often miss `aria-expanded` and `aria-controls`, leaving screen reader users unaware of the state change.
**Action:** Always bind `aria-expanded={isOpen}` to the toggle button and `id` to the content region.

## 2025-02-18 - Modal Focus & Semantics
**Learning:** Relying on `div` overlays for modals without `role="dialog"` and `aria-modal="true"` leaves screen reader users stranded in the main document flow. Simple visual "X" buttons are invisible to AT without explicit `aria-label`.
**Action:** Enforce `role="dialog"`, `aria-modal="true"`, and accessible names for all custom modals. Ensure custom toggle buttons (like platform selectors) use `aria-pressed` to communicate state, not just color.

## 2025-05-19 - Vitest Axe Integration
**Learning:** `vitest-axe` matchers are not exported from the package root in this environment, causing test crashes. Additionally, `jsdom` lacks full `getComputedStyle` support for pseudo-elements, causing noisy (but non-fatal) errors during `axe-core` execution.
**Action:** Import matchers from `vitest-axe/matchers` explicitly. For clean test output, consider mocking `getComputedStyle` or filtering console errors if color contrast checks are not the primary target.
