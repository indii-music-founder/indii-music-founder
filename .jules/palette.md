## 2024-05-22 - Accessible Icon Buttons in Collapsed Navigation
**Learning:** Collapsed sidebars often rely on visual cues (icons) but strip away text labels, leaving screen reader users without context unless `aria-label` is explicitly managed based on the collapsed state.
**Action:** When implementing collapsible navigation or UI elements, always pair the visual state toggle with a corresponding `aria-label` update or ensure the tooltip/accessible name is robust enough to handle the text-less state.

## 2024-05-23 - Resurfacing Hidden Accessibility Features
**Learning:** Found critical voice accessibility logic (`handleMicClick`) buried in unused code. Features that aid accessibility (like dictation) should not be hidden behind arbitrary flags or missing UI, as they benefit all users, not just those with disabilities.
**Action:** When auditing components, check for "dead" event handlers that might be orphan accessibility features. Re-enable them with proper visual states (`isListening`) and feedback loops.
