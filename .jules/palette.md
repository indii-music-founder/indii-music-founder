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

## 2024-05-24 - Segmented Controls as Tabs
**Learning:** Segmented controls that switch between distinct views are often implemented as buttons, missing the semantic relationship between the control and the view. Using `role="tablist"`/`tab`/`tabpanel` clarifies this relationship for screen readers.
**Action:** When a set of buttons toggles exclusive views, upgrade them to the ARIA Tab pattern to provide context on the current selection and the controlled content.
