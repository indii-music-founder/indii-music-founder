# PALETTE'S JOURNAL - UX/A11Y ARCHIVE

## 2025-02-19 - Accessibility Barrier in Video Timeline
**Learning:** The `TimeRuler` component in the Video Editor was `div`-based and lacked keyboard accessibility, preventing keyboard-only users from scrubbing the timeline.
**Action:** Added `role='slider'`, `tabIndex={0}`, and `onKeyDown` handler to `TimeRuler.tsx`. Verified with `aria-valuenow` updates and focus rings.
