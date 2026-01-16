## 2024-05-23 - Icon-Only Buttons Pattern
**Learning:** This codebase frequently uses icon-only buttons (e.g., Edit, Delete, Close) without `aria-label` attributes, relying solely on visual icons. This is a recurring accessibility gap.
**Action:** When touching components with icon-only buttons, systematically check for and add descriptive `aria-label` attributes to ensure screen reader accessibility.

## 2026-01-16 - Dynamic State Labels
**Learning:** Action buttons that change visual state (e.g. "Run" -> Spinner) lose their accessible name, leaving screen reader users with an unlabelled "button".
**Action:** Implement dynamic `aria-label` attributes that describe the current state (e.g., "Processing command" vs "Run command").
