# Palette's Journal - Critical Learnings

## 2024-05-22 - Accessibility in Icon Buttons
**Learning:** Icon-only buttons often miss `aria-label` or `title` attributes, making them inaccessible to screen readers.
**Action:** When creating or modifying icon-only buttons, always include `aria-label` or `title` to describe the action.

## 2024-05-22 - Explicit Form Labeling
**Learning:** Input fields often have visual labels but lack programmatic association via `htmlFor` and `id`. This prevents screen readers from announcing the label when the input is focused and breaks "click label to focus" behavior.
**Action:** Always pair `<label htmlFor="x">` with `<input id="x">` in forms.
