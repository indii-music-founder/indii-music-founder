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
