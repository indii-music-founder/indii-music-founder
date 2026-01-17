## 2025-06-27 - [Toolbar Layouts]
**Learning:** Absolute positioning (`absolute bottom-3`) for toolbars creates fragile layouts on mobile that break when content scales or containers resize.
**Action:** Always use `flex justify-between items-center` with `min-h-[44px]` for input toolbars to ensure buttons remain accessible and the layout adapts to content changes.
