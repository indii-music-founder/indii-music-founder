## 2024-05-23 - [Nested Textbox Roles]
**Learning:** The `AI_Input_Search` component has a container with `role="textbox"` wrapping the actual `<textarea>` (which also has an implicit `textbox` role). This causes `getByRole('textbox')` to return multiple elements, breaking tests that assume a single input.
**Action:** Use specific selectors like `getByPlaceholderText` or `getByRole('textbox', { name: ... })` to disambiguate nested interactive elements. Always check if container wrappers have ARIA roles that might shadow or duplicate internal element roles.
