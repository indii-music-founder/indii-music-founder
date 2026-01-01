## 2024-05-24 - Accessibility improvements for color pickers
**Learning:** Color pickers implemented as `div`s with `onClick` are common but inaccessible. Converting them to `button` elements provides native keyboard support (tab, enter/space) and focus management without extra JavaScript. Adding `aria-label` provides necessary context for screen readers that would otherwise only see an empty element with a background color.
**Action:** When creating color selection interfaces, always use `button` elements or `input type="radio"`/`checkbox` for selection. Ensure they have accessible labels describing the color (e.g., "Select red") rather than just visual representation.

## 2025-05-18 - Tab Accessibility with ARIA and Unique IDs
**Learning:** Custom Tab components often lack semantic roles (`tablist`, `tab`, `tabpanel`) and proper ARIA relationships (`aria-controls`, `aria-labelledby`). By generating a unique `baseId` (via `React.useId`) in the Tabs context, we can automatically link triggers to panels with stable IDs, ensuring screen readers can announce the relationship correctly without requiring manual ID management from the developer.
**Action:** When implementing or enhancing compound components like Tabs, Accordions, or Menus, use `React.useId` to generate a stable namespace for linking related elements via ARIA attributes.
