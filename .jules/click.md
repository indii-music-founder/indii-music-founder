## 2024-05-23 - [Form Submission Validation Conflict]
**Learning:** Browser native validation (`required`) often preempts React `onSubmit` handlers in testing environments (like JSDOM), causing "dead clicks" where no event handler runs. This makes verifying custom feedback (like Toasts) difficult without bypassing browser validation.
**Action:** Use `noValidate` on `<form>` elements during tests (or conditionally in code) when verifying custom validation logic, ensuring the `onSubmit` handler is reachable for assertions.
