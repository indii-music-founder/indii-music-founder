## 2024-05-22 - ChatOverlay Streaming & Focus
**Learning:** Streaming text updates in `aria-live` regions can cause screen readers to re-read the entire content on every character addition if the region is not configured correctly or if the updates are too frequent.
**Action:** Use `aria-live="polite"` on the message container but ensure we don't trigger updates for every character. Alternatively, rely on the user manually checking the message after the "Thinking..." state resolves, or use a dedicated "status" region for the "Thinking" state.

## 2024-05-22 - Collapsible Sections
**Learning:** Custom collapsible sections (like `ThoughtChain`) often miss `aria-expanded` and `aria-controls`, leaving screen reader users unaware of the state change.
**Action:** Always bind `aria-expanded={isOpen}` to the toggle button and `id` to the content region.
