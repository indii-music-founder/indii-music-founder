## 2024-05-23 - Test File Overwriting
**Learning:** Always verify if a test file exists before creating it, even if `list_files` on the parent directory missed it (or I missed it in the output). Overwriting existing test files destroys valuable functional tests.
**Action:** Use `list_files` on the specific subdirectory (e.g., `src/modules/onboarding/pages/`) before creating a file like `OnboardingPage.test.tsx`.
# PALETTE'S JOURNAL - UX/A11Y ARCHIVE

## 2025-02-19 - Accessibility Barrier in Video Timeline
**Learning:** The `TimeRuler` component in the Video Editor was `div`-based and lacked keyboard accessibility, preventing keyboard-only users from scrubbing the timeline.
**Action:** Added `role='slider'`, `tabIndex={0}`, and `onKeyDown` handler to `TimeRuler.tsx`. Verified with `aria-valuenow` updates and focus rings.
