## 2024-05-24 - Accessibility improvements for color pickers
**Learning:** Color pickers implemented as `div`s with `onClick` are common but inaccessible. Converting them to `button` elements provides native keyboard support (tab, enter/space) and focus management without extra JavaScript. Adding `aria-label` provides necessary context for screen readers that would otherwise only see an empty element with a background color.
**Action:** When creating color selection interfaces, always use `button` elements or `input type="radio"`/`checkbox` for selection. Ensure they have accessible labels describing the color (e.g., "Select red") rather than just visual representation.

## 2025-05-21 - Custom File Upload Triggers
**Learning:** Using a `div` with `onClick` to trigger a hidden file input (`ref.current.click()`) is a common pattern for custom file upload UIs, but it often completely excludes keyboard users. The `div` needs `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler (for Enter/Space) to be accessible.
**Action:** Always add keyboard interaction support to custom file upload triggers. Ensure the trigger element is focusable and has an appropriate ARIA label indicating its purpose (e.g., "Upload image").
