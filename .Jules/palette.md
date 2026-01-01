## 2024-05-24 - Accessibility improvements for color pickers
**Learning:** Color pickers implemented as `div`s with `onClick` are common but inaccessible. Converting them to `button` elements provides native keyboard support (tab, enter/space) and focus management without extra JavaScript. Adding `aria-label` provides necessary context for screen readers that would otherwise only see an empty element with a background color.
**Action:** When creating color selection interfaces, always use `button` elements or `input type="radio"`/`checkbox` for selection. Ensure they have accessible labels describing the color (e.g., "Select red") rather than just visual representation.

## 2026-01-01 - Tabs Component Accessibility
**Learning:** React components often use `div`s for tabs, missing critical accessibility features. Implementing WAI-ARIA patterns (`role="tablist"`, `role="tab"`, `role="tabpanel"`) and linking them via `aria-controls` and `aria-labelledby` is essential. Using `React.useId()` ensures unique IDs even with multiple instances.
**Action:** Always implement full ARIA roles and relationships for Tab components. Ensure tab panels are focusable (`tabIndex={0}`) to support keyboard users navigating to the content.
## 2025-05-18 - Tab Accessibility with ARIA and Unique IDs
**Learning:** Custom Tab components often lack semantic roles (`tablist`, `tab`, `tabpanel`) and proper ARIA relationships (`aria-controls`, `aria-labelledby`). By generating a unique `baseId` (via `React.useId`) in the Tabs context, we can automatically link triggers to panels with stable IDs, ensuring screen readers can announce the relationship correctly without requiring manual ID management from the developer.
**Action:** When implementing or enhancing compound components like Tabs, Accordions, or Menus, use `React.useId` to generate a stable namespace for linking related elements via ARIA attributes.
## 2025-05-21 - Custom File Upload Triggers
**Learning:** Using a `div` with `onClick` to trigger a hidden file input (`ref.current.click()`) is a common pattern for custom file upload UIs, but it often completely excludes keyboard users. The `div` needs `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler (for Enter/Space) to be accessible.
**Action:** Always add keyboard interaction support to custom file upload triggers. Ensure the trigger element is focusable and has an appropriate ARIA label indicating its purpose (e.g., "Upload image").
