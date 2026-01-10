## 2024-05-23 - [Improved Form Validation Pattern]
**Learning:** Users (and developers) often default to generic "toast" errors which frustrate completion. Inline validation with focus management is a critical "micro-UX" win that is surprisingly easy to implement with standard React Refs.
**Action:** When auditing forms, always check if `noValidate` is used without custom inline feedback. If so, implement the `errors` state pattern + `focus()` on first error.

## 2024-05-24 - [Keyboard Accessibility for Hover Actions]
**Learning:** Hover-only actions (opacity-0) are invisible to keyboard users, creating a "phantom focus" trap where users tab to invisible elements.
**Action:** Always pair `group-hover:opacity-100` with `group-focus-within:opacity-100` for overlays containing interactive elements.
