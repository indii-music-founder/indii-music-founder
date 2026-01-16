## 2024-05-23 - Icon-Only Buttons Pattern
**Learning:** This codebase frequently uses icon-only buttons (e.g., Edit, Delete, Close) without `aria-label` attributes, relying solely on visual icons. This is a recurring accessibility gap.
**Action:** When touching components with icon-only buttons, systematically check for and add descriptive `aria-label` attributes to ensure screen reader accessibility.

## 2024-05-24 - Lucide Icon Mocking in Tests
**Learning:** Unit tests mocking `lucide-react` must be manually updated whenever a new icon is imported in the source code, otherwise tests fail with "No export defined on the mock".
**Action:** When adding a new icon to a component, immediately grep for `vi.mock('lucide-react'` in associated test files and add the new icon to the mock return object.
## 2026-01-16 - Dynamic State Labels
**Learning:** Action buttons that change visual state (e.g. "Run" -> Spinner) lose their accessible name, leaving screen reader users with an unlabelled "button".
**Action:** Implement dynamic `aria-label` attributes that describe the current state (e.g., "Processing command" vs "Run command").
