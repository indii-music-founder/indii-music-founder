## 2024-05-23 - [Improved Form Validation Pattern]
**Learning:** Users (and developers) often default to generic "toast" errors which frustrate completion. Inline validation with focus management is a critical "micro-UX" win that is surprisingly easy to implement with standard React Refs.
**Action:** When auditing forms, always check if `noValidate` is used without custom inline feedback. If so, implement the `errors` state pattern + `focus()` on first error.

## 2024-05-24 - [Hidden Action Trap]
**Learning:** Hover-revealed actions (like "Use generated image" overlays) are completely invisible to keyboard users if they rely solely on `opacity-0 group-hover:opacity-100`. The action exists in the DOM but cannot be seen when focused.
**Action:** Always pair `group-hover` with `group-focus-within` (e.g., `group-focus-within:opacity-100`) and ensure interactive children have visible focus rings (`focus-visible:ring`).

## 2025-02-18 - [CandidatesCarousel Accessibility]
**Learning:** Action overlays on image cards often lack keyboard focus visibility, making them "phantom" traps.
**Action:** Implemented `group-focus-within:opacity-100` pattern on `CandidatesCarousel`, confirming it as a standard solution for this recurring UI pattern.

## 2024-05-24 - [Keyboard Accessibility for Hover Actions]
**Learning:** Hover-only actions (opacity-0) are invisible to keyboard users, creating a "phantom focus" trap where users tab to invisible elements.
**Action:** Always pair `group-hover:opacity-100` with `group-focus-within:opacity-100` for overlays containing interactive elements.

## 2024-05-24 - [Hidden Actions Accessibility]
**Learning:** Hover-revealed actions (like "Use generated image" overlays) are invisible to keyboard users unless explicitly handled. Standardizing on `group-focus-within:opacity-100` ensures these actions become visible when tabbing into the container.
**Action:** Whenever using `group-hover:opacity-100` for action overlays, always pair it with `group-focus-within:opacity-100` and ensure interactive children have visible focus states.

## 2024-05-24 - [Hidden Action Trap]
**Learning:** Hover-revealed actions (opacity-0) are invisible to keyboard users, creating a "phantom focus" trap where users tab to invisible elements.
**Action:** Always pair `group-hover:opacity-100` with `group-focus-within:opacity-100` for overlays containing interactive elements.

## 2024-05-24 - [Hidden Focus Trap Fixed]
**Learning:** Hover-revealed actions (like selection overlays) must use  and  to be accessible to keyboard users.
**Action:** When creating overlays, always ensure they are revealed on focus as well as hover.

## 2024-05-24 - [Hidden Focus Trap Fixed]
**Learning:** Hover-revealed actions (like selection overlays) must use `focus-visible:opacity-100` and `group-focus-within:opacity-100` to be accessible to keyboard users.
**Action:** When creating overlays, always ensure they are revealed on focus as well as hover.

## 2025-05-28 - [Accessible Candidates Carousel]
**Learning:** Horizontal scrolling lists (carousels) with hover-revealed actions create a "double trap" for keyboard users: they can't see the actions, and they might get stuck navigating a long list without a clear exit.
**Action:** Ensure all hover-revealed actions in carousels use `group-focus-within:opacity-100` and `focus-visible:opacity-100`. Always provide an accessible `aria-label` for "Close" buttons that use icons.

## 2026-01-13 - [Interactive List Item Trap]
**Learning:** List items that use `onClick` on a `div` are inaccessible to keyboard users, who can't tab to them or activate them with keys.
**Action:** Always add `role="button"`, `tabIndex={0}`, and `onKeyDown` (handling Enter/Space) to interactive list items, and ensure nested actions (like delete) are focusable and visible on focus.
## 2025-10-26 - [ProjectHub Menu Accessibility]
**Learning:** The "More Vertical" menu in `ProjectHub` was a classic "Hidden Action Trap". It was only visible on hover, making it accessible to mouse users but a mystery to keyboard users who would tab onto an invisible button.
**Action:** Applied `group-focus-within:opacity-100` to the container and added `focus-visible:ring-2` to the button. This ensures the menu appears when any element inside it receives focus, and the button itself has a clear focus indicator. Also added `aria-label` for screen reader context.
