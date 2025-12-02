# Mobile View Improvements

## Objective

Optimize the indiiOS Studio application for mobile devices, ensuring a responsive, usable, and aesthetically pleasing experience on smaller screens.

## Status: In Progress

### 1. Navigation & Layout

- [x] **Viewport Configuration:** Verified `viewport-fit=cover` and `user-scalable=no` in `index.html`.
- [x] **Responsive Navbar:** Implemented `CreativeNavbar` with mobile-optimized layout (icons only on small screens).
- [x] **Dashboard Grid:** Updated `Dashboard.tsx` to use `grid-cols-1` on mobile and `grid-cols-3` on desktop.
- [x] **Studio Controls:** `StudioNavControls` now stacks gracefully on mobile.
- [x] **Dashboard Header:** Responsive layout for title and action buttons (icon-only on mobile).

### 2. Components

- [x] **Buttons:** Updated "New Project" and "Brand Kit" buttons to be icon-only on mobile to save space.
- [x] **Sign Out:** Added responsive "Sign Out" button.
- [ ] **Modals:** Verify `OnboardingModal` and `NewProjectModal` fit within mobile viewports without scrolling issues.
- [ ] **Inputs:** Ensure font size is at least 16px to prevent iOS auto-zoom.
- [ ] **Touch Targets:** Verify all interactive elements meet the 44x44px minimum.

### 3. Performance

- [ ] **Liquid Orbs:** Monitor performance on low-end devices (part of [Stress Test Plan](./STRESS_TEST_PLAN.md)).
- [ ] **Image Loading:** Implement lazy loading for Gallery images on mobile.

## Next Steps

1. Execute the Stress Test Plan on a real mobile device.
2. Audit Modal responsiveness.
