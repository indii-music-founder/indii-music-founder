## 2026-05-22 - Mobile Stacking Contexts & Navigation
**Learning:** Fixed positioning (`fixed inset-0`) for the ChatOverlay on mobile creates a new stacking context that can obscure other "always-on" UI elements like the CommandBar if z-indices are not explicitly managed. The CommandBar (static/relative) was hidden behind the ChatOverlay (fixed z-100).
**Action:** Ensure global UI elements (CommandBar, FABs) have explicit z-indices higher than full-screen overlays on mobile. Added `z-[101]` to CommandBar and `z-[102]` to MobileNav FAB.

## 2026-05-22 - E2E Auth & UI Evolution
**Learning:** Legacy mobile E2E tests were failing because they assumed a deprecated "Bottom Tab Bar" UI (replaced by FAB) and lacked authentication steps.
**Action:** Updated tests to use the new FAB selectors (`button[aria-label="Open Navigation"]`) and implemented `Guest Login (Dev)` bypass in `beforeEach` hooks to ensure tests run against the actual app state.

## 2026-05-22 - Virtual Keyboard Layout Squeeze
**Learning:** Resizing the viewport height to simulate a virtual keyboard (e.g., from 812px to 512px) triggers a layout reflow. The `CommandBar` correctly stays anchored to the bottom of the visual viewport, and the chat container resizes. This confirms that `dvh` or standard flexbox column layouts are handling the height change gracefully without manual resize listeners.
**Action:** Continue using `page.setViewportSize` to simulate keyboard interactions in E2E tests. No custom "keyboard detection" logic is needed in the app code if CSS is robust.

## 2026-05-24 - Mobile Navigation Config Drift
**Learning:** `MobileNav.tsx` and `Sidebar.tsx` maintain separate, hardcoded lists of navigation items (`toolItems`, `managerItems`). This led to a regression where the "History" module was accessible on desktop but completely missing on mobile.
**Action:** In the future, verify navigation parity between Desktop (`Sidebar`) and Mobile (`MobileNav`) whenever adding new modules. Ideally, refactor to a shared navigation configuration constant.
