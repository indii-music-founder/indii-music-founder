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
## 2024-05-23 - [Modal Accessibility Pattern]
**Learning:** This project lacks a shared `Modal` or `Dialog` component in `src/components/ui`. Developers are creating custom modals (like `CreateCampaignModal`) that often miss standard accessibility features (Escape key, backdrop click, focus management).
**Action:** When working on modals in this repo, always manually verify and implement: 1. `useEffect` for 'Escape' key. 2. `onClick` handler for backdrop closing (checking `e.target === e.currentTarget`). 3. `role="dialog"` and `aria-modal="true"`. 4. `autoFocus` on the first interactive element.

## 2025-05-24 - [Drag and Drop Accessibility]
**Learning:** Drag-and-drop zones (like `AssetDropzone`) are often implemented as purely pointer-based `div`s, completely excluding keyboard users.
**Action:** Transform these zones into "dual-mode" controls:
1. Add `role="button"` and `tabIndex={0}` to the container.
2. Implement `onKeyDown` (Enter/Space) to trigger the hidden file input's `click()`.
3. Add visible focus indicators (`focus-visible:ring-2`) to guide keyboard users.
4. Provide clear instructions via `aria-label` or helper text.
