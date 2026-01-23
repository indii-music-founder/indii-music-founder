## 2024-05-22 - Accessible Icon Buttons in Collapsed Navigation
**Learning:** Collapsed sidebars often rely on visual cues (icons) but strip away text labels, leaving screen reader users without context unless `aria-label` is explicitly managed based on the collapsed state.
**Action:** When implementing collapsible navigation or UI elements, always pair the visual state toggle with a corresponding `aria-label` update or ensure the tooltip/accessible name is robust enough to handle the text-less state.

## 2024-05-24 - Semantics of Custom Loaders
**Learning:** Custom loading components often lack semantic meaning, relying purely on visual cues like spinners. Adding `role="status"` and `aria-live="polite"` makes them immediately accessible to screen readers without changing the visual design.
**Action:** Always wrap custom loaders in a container with `role="status"` and ensuring inner decorative elements (spinners) are hidden with `aria-hidden="true"`.
