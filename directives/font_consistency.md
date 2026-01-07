# Font Consistency Directive

## Goal

Ensure a premium, unified user experience by enforcing the indiiOS typography standard across all application modules.

## Standard Operating Procedure (SOP)

### 1. Single Source of Truth

- All font-family definitions MUST reside in `src/index.css` as CSS variables.
- Standard variables:
  - `--font-main`: Internal/UI Sans (Inter)
  - `--font-mono`: Technical/Code (JetBrains Mono)
  - `--font-display`: Branding/Headers (Geist)

### 2. Tailwind v4 Mapping

- The `@theme` block in `src/index.css` MUST map the following Tailwind utilities:

  ```css
  --font-sans: var(--font-main);
  --font-mono: var(--font-mono);
  --font-display: var(--font-display);
  ```

### 3. Usage Rules

- **Prefer Utilities:** Use `font-sans`, `font-mono`, or `font-display` classes instead of hardcoded font names.
- **Global Default:** The `body` element MUST have `font-family: var(--font-main);` applied via `@layer base`.
- **No Overrides:** Avoid inline `style={{ fontFamily: '...' }}` or local CSS font overrides unless explicitly approved for a specific design-heavy creative module.

## Verification

- Inspect computed styles via browser tools to ensure no fallback to browser defaults (e.g., Times New Roman or user agent sans-serif).
- Verify that dark mode and thematic overrides (like Banana Pro) preserve font consistency.
