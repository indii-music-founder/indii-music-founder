## 2024-05-23 - Bidirectional Linkage for Collapsible Regions
**Learning:** `aria-expanded` and `aria-controls` on a button are not enough; the controlled region must be identifiable, ideally via `aria-labelledby` pointing back to the button, especially for screen reader context when navigating content.
**Action:** When implementing collapsible regions, ensure bidirectional linkage: `button[aria-controls=region-id]` and `region[aria-labelledby=button-id]`.

## 2024-05-23 - ARIA Feed Children Constraints
**Learning:** `role="feed"` strictly requires `role="article"` children. Interactive controls (like "Load More" buttons) must reside *outside* the feed container to avoid `aria-required-children` violations.
**Action:** Verify mock structures for virtualized lists to ensure `axe-core` doesn't report false positives due to invalid child nesting in tests.

## 2025-02-18 - Hidden Inputs & Axe
**Learning:** `axe-core` flags `<input type="file" class="hidden">` as missing labels if `display: none` is not computed in the test environment (JSDOM).
**Action:** Explicitly use `style={{ display: 'none' }}` or add `aria-label` to hidden functional inputs to satisfy accessibility checks in all environments.

## 2025-02-18 - Keyboard Trap & Focus Restoration
**Learning:** Custom menus/modals must manually handle `Escape` key to close and restore focus to the trigger element upon closing to maintain keyboard navigation flow.
**Action:** Use `useEffect` for `keydown` listeners and `useRef` to track and restore focus to the trigger button.

## 2025-05-24 - Duplicate ARIA Labels in Composition
**Learning:** Passing `aria-label` to a component that uses `asChild` (like Radix `TooltipTrigger`) while also defining it on the child element can result in duplicate attributes in the rendered DOM, causing React warnings and potential screen reader verbosity.
**Action:** When using `asChild` composition pattern, ensure `aria-label` is applied only once, preferably on the component that renders the final DOM element or let the parent pass it down cleanly.

## 2025-05-24 - Icon-Only Buttons and Test Queries
**Learning:** `getByText` fails for icon-only buttons even if they have `title` or `aria-label`. `getByRole('button', { name: '...' })` is the robust way to query these and simultaneously verify the accessible name.
**Action:** Always use `getByRole` with the `name` option for interactive elements to verify both existence and accessibility compliance.

## 2025-05-24 - JSDOM Range Input Interaction
**Learning:** `userEvent.keyboard` does not trigger value changes on `<input type="range">` in JSDOM environments, unlike real browsers.
**Action:** Use `userEvent.tab()` to verify focusability, but fallback to `fireEvent.change` to test the `onChange` logic in unit tests, acknowledging the environment limitation.

## 2026-01-26 - Focus Stealing by Click-to-Focus Wrappers
**Learning:** Wrapping interactive elements (e.g., secondary buttons) inside a container that implements "click to focus" (e.g., focusing a textarea) creates a conflict. The container's click handler fires after the button's, stealing focus away from the button or the newly opened menu.
**Action:** Use `event.stopPropagation()` on the `onClick` handlers of all nested interactive elements to prevent the event from bubbling to the focus-stealing container.

## 2026-06-26 - Dual Error Strategy for Animated Alerts
**Learning:** `AnimatePresence` can unmount visual elements before screen readers finish announcing them, and `aria-live` regions inside animating containers can be unreliable.
**Action:** Implement a "Dual Error Strategy": render the visual error (with `aria-hidden="true"`) for sighted users, and a separate, persistent `sr-only` element with `role="alert"` and `aria-live="assertive"` for screen readers.
