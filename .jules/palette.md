## 2024-05-23 - [Improved Form Validation Pattern]
**Learning:** Users (and developers) often default to generic "toast" errors which frustrate completion. Inline validation with focus management is a critical "micro-UX" win that is surprisingly easy to implement with standard React Refs.
**Action:** When auditing forms, always check if `noValidate` is used without custom inline feedback. If so, implement the `errors` state pattern + `focus()` on first error.

## 2024-05-24 - [Hidden Actions Accessibility]
**Learning:** Hover-revealed actions (like "Use generated image" overlays) are invisible to keyboard users unless explicitly handled. Standardizing on `group-focus-within:opacity-100` ensures these actions become visible when tabbing into the container.
**Action:** Whenever using `group-hover:opacity-100` for action overlays, always pair it with `group-focus-within:opacity-100` and ensure interactive children have visible focus states.
