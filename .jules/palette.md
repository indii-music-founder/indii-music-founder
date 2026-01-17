# Palette's Journal - Critical Learnings

## 2024-05-24 - Lucide Icon Mocking in Tests
**Learning:** Unit tests mocking `lucide-react` must be manually updated whenever a new icon is imported in the source code, otherwise tests fail with "No export defined on the mock".
**Action:** When adding a new icon to a component, immediately grep for `vi.mock('lucide-react'` in associated test files and add the new icon to the mock return object.

## 2026-01-16 - Dynamic State Labels
**Learning:** Action buttons that change visual state (e.g. "Run" -> Spinner) lose their accessible name, leaving screen reader users with an unlabelled "button".
**Action:** Implement dynamic `aria-label` attributes that describe the current state (e.g., "Processing command" vs "Run command").

## 2026-01-20 - Toggle Buttons as Checkboxes
**Learning:** Icon-only buttons used as toggles (e.g., checkmarks) are often implemented as standard buttons. Without `role="checkbox"` (or `switch`) and `aria-checked`, screen readers cannot convey the state or the interactivity correctly.
**Action:** Explicitly add `role="checkbox"` and `aria-checked={isChecked}` to toggle buttons, along with a descriptive `aria-label` that explains what is being selected.
## 2024-05-22 - Accessibility in Icon Buttons
**Learning:** Icon-only buttons often miss `aria-label` or `title` attributes, making them inaccessible to screen readers.
**Action:** When creating or modifying icon-only buttons, always include `aria-label` or `title` to describe the action.

## 2024-05-22 - Explicit Form Labeling
**Learning:** Input fields often have visual labels but lack programmatic association via `htmlFor` and `id`. This prevents screen readers from announcing the label when the input is focused and breaks "click label to focus" behavior.
**Action:** Always pair `<label htmlFor="x">` with `<input id="x">` in forms.
