## 2024-05-20 - [Tailwind CSS Classes in Tests]
**Learning:** `toHaveClass` verifies the *presence* of a class in the `className` string, not whether it is "active". Utility classes like `disabled:opacity-50` remain in the DOM even when the element is enabled, causing assertions like `not.toHaveClass('disabled:opacity-50')` to fail unexpectedly.
**Action:** Rely on `toBeDisabled()` for functional state verification. Only use `toHaveClass` to check for conditional classes that are actually added/removed from the DOM (e.g. `is-active`), not for static utility classes.
