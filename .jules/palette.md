## 2024-05-23 - [Improved Form Validation Pattern]
**Learning:** Users (and developers) often default to generic "toast" errors which frustrate completion. Inline validation with focus management is a critical "micro-UX" win that is surprisingly easy to implement with standard React Refs.
**Action:** When auditing forms, always check if `noValidate` is used without custom inline feedback. If so, implement the `errors` state pattern + `focus()` on first error.

## 2024-05-24 - [Hidden Action Trap]
**Learning:** Hover-revealed actions (like "Use generated image" overlays) are completely invisible to keyboard users if they rely solely on `opacity-0 group-hover:opacity-100`. The action exists in the DOM but cannot be seen when focused.
**Action:** Always pair `group-hover` with `group-focus-within` (e.g., `group-focus-within:opacity-100`) and ensure interactive children have visible focus rings (`focus-visible:ring`).
