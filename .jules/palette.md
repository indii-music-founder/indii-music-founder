## 2024-05-22 - Accessible Icon Buttons in Collapsed Navigation
**Learning:** Collapsed sidebars often rely on visual cues (icons) but strip away text labels, leaving screen reader users without context unless `aria-label` is explicitly managed based on the collapsed state.
**Action:** When implementing collapsible navigation or UI elements, always pair the visual state toggle with a corresponding `aria-label` update or ensure the tooltip/accessible name is robust enough to handle the text-less state.

## 2024-05-23 - Exposing Hidden Accessibility Features
**Learning:** Powerful accessibility features (like voice input) often exist in the codebase logic (e.g., `handleMicClick`) but are inaccessible because they lack a UI trigger, assuming they are "nice to haves" or "future features".
**Action:** Actively audit service layers for capabilities (like `VoiceService`) that are not exposed in the UI and create explicit, accessible triggers (buttons with `aria-label`) for them, especially for alternate input methods.
