## 2024-05-23 - Test File Overwriting
**Learning:** Always verify if a test file exists before creating it, even if `list_files` on the parent directory missed it (or I missed it in the output). Overwriting existing test files destroys valuable functional tests.
**Action:** Use `list_files` on the specific subdirectory (e.g., `src/modules/onboarding/pages/`) before creating a file like `OnboardingPage.test.tsx`.
# PALETTE'S JOURNAL - UX/A11Y ARCHIVE

## 2025-02-19 - Accessibility Barrier in Video Timeline
**Learning:** The `TimeRuler` component in the Video Editor was `div`-based and lacked keyboard accessibility, preventing keyboard-only users from scrubbing the timeline.
**Action:** Added `role='slider'`, `tabIndex={0}`, and `onKeyDown` handler to `TimeRuler.tsx`. Verified with `aria-valuenow` updates and focus rings.

## 2025-02-20 - Nested Interactive Elements Conflict
**Learning:** In the `LayersPanel`, the parent `div` had `role="button"` and an `onKeyDown` handler for selection, which inadvertently intercepted `Enter` key events from nested action buttons (visibility, lock, etc.), breaking their keyboard accessibility.
**Action:** Added a check in the parent's `onKeyDown` handler to ignore events originating from nested `BUTTON` elements, ensuring that child actions remain accessible while preserving row selection.

## 2025-05-24 - File Input Accessibility
**Learning:** File inputs hidden with `display: none` (or `.hidden`) inside labels cannot be focused via keyboard, breaking accessibility for uploaders.
**Action:** Use `.sr-only` on the input to keep it in the DOM/accessibility tree, and apply `focus-within:ring` to the parent label to provide visual focus indication.

## 2025-05-25 - Onboarding Modal Accessibility
**Learning:** Modal action buttons (Close, Attach, Send) were icon-only and completely invisible to screen readers, creating a "trap" where users couldn't exit or interact.
**Action:** Added explicit `aria-label`s to all icon buttons in `OnboardingModal.tsx` and ensured the conditional file removal button is focusable (`focus:opacity-100`).

## 2025-05-26 - Auto-Labeling Tooltip Triggers
**Learning:** Icon-only buttons wrapped in Tooltips often lack `aria-label`, making them inaccessible. Radix UI's `TooltipTrigger` with `asChild` merges props, allowing us to automatically inject `aria-label` from the tooltip text.
**Action:** Updated `PromptInputAction` to pass `aria-label={tooltip}` to `TooltipTrigger` when tooltip is a string, ensuring all action buttons are automatically labeled without extra code.
