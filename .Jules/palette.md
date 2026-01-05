# Palette's Journal - Critical Learnings

## 2024-05-22 - Initial Entry
**Learning:** UX is a process, not a destination.
**Action:** Start by observing the existing codebase and identifying small, high-impact improvements.

## 2024-05-22 - Nested Interactive Elements in Cards
**Learning:** When turning a card container into a `role="button"` (e.g., `CampaignCard`) that also contains other interactive buttons (like a "More options" menu), standard event bubbling causes keyboard regressions. Pressing Enter on the inner button triggers the parent's `onKeyDown` handler, hijacking the action.
**Action:** Always implement `e.stopPropagation()` on the inner button's `onKeyDown` and `onClick` handlers to isolate its behavior from the parent container.

## 2025-05-23 - Modal Accessibility Standards
**Learning:** Modals often lack semantic structure, making them invisible or confusing to screen readers. Specifically, they miss `role="dialog"`, `aria-modal="true"`, and keyboard support for the Escape key, which is a critical expectation for keyboard users.
**Action:** Always wrap modal overlays with `role="dialog"` and `aria-modal="true"`, link the title via `aria-labelledby`, and ensure `useEffect` handles the Escape key to close the modal.
