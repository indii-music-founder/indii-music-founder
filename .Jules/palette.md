## 2024-05-22 - Accessible Icon Buttons in Collapsed Navigation
**Learning:** Collapsed sidebars often rely on visual cues (icons) but strip away text labels, leaving screen reader users without context unless `aria-label` is explicitly managed based on the collapsed state.
**Action:** When implementing collapsible navigation or UI elements, always pair the visual state toggle with a corresponding `aria-label` update or ensure the tooltip/accessible name is robust enough to handle the text-less state.

## 2024-05-23 - Exposing Hidden Accessibility Features
**Learning:** Powerful accessibility features (like voice input) often exist in the codebase logic (e.g., `handleMicClick`) but are inaccessible because they lack a UI trigger, assuming they are "nice to haves" or "future features".
**Action:** Actively audit service layers for capabilities (like `VoiceService`) that are not exposed in the UI and create explicit, accessible triggers (buttons with `aria-label`) for them, especially for alternate input methods.
## 2024-05-23 - Resurfacing Hidden Accessibility Features
**Learning:** Found critical voice accessibility logic (`handleMicClick`) buried in unused code. Features that aid accessibility (like dictation) should not be hidden behind arbitrary flags or missing UI, as they benefit all users, not just those with disabilities.
**Action:** When auditing components, check for "dead" event handlers that might be orphan accessibility features. Re-enable them with proper visual states (`isListening`) and feedback loops.
## 2024-05-24 - Semantics of Custom Loaders
**Learning:** Custom loading components often lack semantic meaning, relying purely on visual cues like spinners. Adding `role="status"` and `aria-live="polite"` makes them immediately accessible to screen readers without changing the visual design.
**Action:** Always wrap custom loaders in a container with `role="status"` and ensuring inner decorative elements (spinners) are hidden with `aria-hidden="true"`.

## 2025-02-20 - Nested Interactive Elements Conflict
**Learning:** In the `LayersPanel`, the parent `div` had `role="button"` and an `onKeyDown` handler for selection, which inadvertently intercepted `Enter` key events from nested action buttons (visibility, lock, etc.), breaking their keyboard accessibility.
**Action:** Added a check in the parent's `onKeyDown` handler to ignore events originating from nested `BUTTON` elements, ensuring that child actions remain accessible while preserving row selection.

## 2025-05-24 - File Input Accessibility
**Learning:** File inputs hidden with `display: none` (or `.hidden`) inside labels cannot be focused via keyboard, breaking accessibility for uploaders.
**Action:** Use `.sr-only` on the input to keep it in the DOM/accessibility tree, and apply `focus-within:ring` to the parent label to provide visual focus indication.

## 2025-05-24 - Semantic Loading States
**Learning:** Custom visual loaders like `DeptLoader` often rely purely on visual cues (spinners), leaving screen reader users unaware of processing states.
**Action:** Always wrap custom loaders in `role="status"` with `aria-live="polite"` and include visually hidden text (or `aria-label`) if no visible text is present.
## 2024-05-24 - Segmented Controls as Tabs
**Learning:** Segmented controls that switch between distinct views are often implemented as buttons, missing the semantic relationship between the control and the view. Using `role="tablist"`/`tab`/`tabpanel` clarifies this relationship for screen readers.
**Action:** When a set of buttons toggles exclusive views, upgrade them to the ARIA Tab pattern to provide context on the current selection and the controlled content.

## 2025-05-25 - Overlay Focus Traps and Rings
**Learning:** Modal overlays (like ChatOverlay) often lack visible focus indicators on close/minimize buttons because they are designed to be "unobtrusive", making them hard to locate for keyboard users.
**Action:** Enforce `focus-visible:ring` on all overlay action buttons, using a contrasting color (e.g., purple/white) to ensure visibility against dark/glass backgrounds.
## 2026-01-25 - Modal Accessibility and Label Association
**Learning:** Custom modals often lack the necessary ARIA roles (`dialog`, `aria-modal`) and labeling (`aria-labelledby`) to be perceived correctly by screen readers. Additionally, inputs within them must have explicit label associations (`htmlFor`/`id`) rather than just visual proximity.
**Action:** When creating or refactoring modals, always implement the standard Dialog pattern (role="dialog", aria-modal="true") and verify that all form inputs have programmatic label associations.

## 2026-05-25 - Custom Input Focus Indicators
**Learning:** Using `appearance-none` on form inputs (like sliders or checkboxes) to enable custom styling removes the browser's default focus ring, making the element invisible to keyboard users.
**Action:** Always explicitly re-add focus styles (e.g., `focus-visible:ring`) when using `appearance-none` to ensure keyboard navigability is preserved.
