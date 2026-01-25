# Palette's Journal

## 2024-05-22 - Initial Setup
**Learning:** Started tracking UX improvements.
**Action:** Look for patterns in the codebase to improve.

## 2024-05-22 - Accessible Custom Modals
**Learning:** Custom modal implementations often miss basic ARIA roles (`dialog`, `aria-modal`) and labels on close buttons, making them invisible or confusing to screen readers.
**Action:** When spotting a `fixed inset-0` div acting as a modal, immediately check for `role="dialog"` and `aria-label` on the close icon.
