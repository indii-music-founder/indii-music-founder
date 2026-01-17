## 2025-06-27 - [Toolbar Layouts]
**Learning:** Absolute positioning (`absolute bottom-3`) for toolbars creates fragile layouts on mobile that break when content scales or containers resize.
**Action:** Always use `flex justify-between items-center` with `min-h-[44px]` for input toolbars to ensure buttons remain accessible and the layout adapts to content changes.

## 2025-05-24 - [Fixed Width on Modal Overlays]
**Learning:** Hardcoded pixel widths (e.g., `w-[500px]`) on modals cause severe overflow on mobile devices, rendering them unusable and off-screen.
**Action:** Use `w-full md:w-[500px]` and `inset-0 md:inset-auto` pattern for responsive modals that need to be full-screen on mobile and floating on desktop.
