## 2024-05-24 - Accessibility improvements for color pickers
**Learning:** Color pickers implemented as `div`s with `onClick` are common but inaccessible. Converting them to `button` elements provides native keyboard support (tab, enter/space) and focus management without extra JavaScript. Adding `aria-label` provides necessary context for screen readers that would otherwise only see an empty element with a background color.
**Action:** When creating color selection interfaces, always use `button` elements or `input type="radio"`/`checkbox` for selection. Ensure they have accessible labels describing the color (e.g., "Select red") rather than just visual representation.

## 2026-01-01 - Tabs Component Accessibility
**Learning:** React components often use `div`s for tabs, missing critical accessibility features. Implementing WAI-ARIA patterns (`role="tablist"`, `role="tab"`, `role="tabpanel"`) and linking them via `aria-controls` and `aria-labelledby` is essential. Using `React.useId()` ensures unique IDs even with multiple instances.
**Action:** Always implement full ARIA roles and relationships for Tab components. Ensure tab panels are focusable (`tabIndex={0}`) to support keyboard users navigating to the content.
