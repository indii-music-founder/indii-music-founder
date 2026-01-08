# Palette's Journal

This journal records critical UX and accessibility learnings for the IndiiOS project.

## 2024-05-24 - [Initialization]
**Learning:** UX consistency relies on shared design tokens and semantic HTML.
**Action:** Always verify changes against `tailwind.config.js` and ARIA standards.

## 2024-05-24 - [Focus Management]
**Learning:** Custom input containers must use `focus-within` to simulate native focus rings.
**Action:** Apply `focus-within:ring-2` to wrapper divs when inner inputs have `outline-none`.
