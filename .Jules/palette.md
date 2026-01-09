## 2024-05-23 - [Improved Form Validation Pattern]
**Learning:** Users (and developers) often default to generic "toast" errors which frustrate completion. Inline validation with focus management is a critical "micro-UX" win that is surprisingly easy to implement with standard React Refs.
**Action:** When auditing forms, always check if `noValidate` is used without custom inline feedback. If so, implement the `errors` state pattern + `focus()` on first error.
