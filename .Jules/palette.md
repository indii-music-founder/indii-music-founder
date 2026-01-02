# Palette's Journal - Critical Learnings

## 2024-05-22 - Initial Entry
**Learning:** UX is a process, not a destination.
**Action:** Start by observing the existing codebase and identifying small, high-impact improvements.

## 2024-05-22 - Nested Interactive Elements in Cards
**Learning:** When turning a card container into a `role="button"` (e.g., `CampaignCard`) that also contains other interactive buttons (like a "More options" menu), standard event bubbling causes keyboard regressions. Pressing Enter on the inner button triggers the parent's `onKeyDown` handler, hijacking the action.
**Action:** Always implement `e.stopPropagation()` on the inner button's `onKeyDown` and `onClick` handlers to isolate its behavior from the parent container.
