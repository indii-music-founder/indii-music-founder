# Access Journal

## 2025-02-14 - Custom UI Component Pitfalls
**Learning:** The codebase contains custom implementations of UI components (like Tabs) that mimic Shadcn/Radix styling but lack the underlying accessibility behaviors (specifically keyboard navigation like Arrow keys), requiring manual `onKeyDown` handler implementation to meet WAI-ARIA authoring practices.
**Action:** When auditing UI components, verify that standard keyboard patterns (Arrows for tabs, Escape for modals) are implemented, as visual similarity to libraries like Radix does not guarantee functional parity.
