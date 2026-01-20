## 2024-05-23 - Bidirectional Linkage for Collapsible Regions
**Learning:** `aria-expanded` and `aria-controls` on a button are not enough; the controlled region must be identifiable, ideally via `aria-labelledby` pointing back to the button, especially for screen reader context when navigating content.
**Action:** When implementing collapsible regions, ensure bidirectional linkage: `button[aria-controls=region-id]` and `region[aria-labelledby=button-id]`.

## 2024-05-23 - ARIA Feed Children Constraints
**Learning:** `role="feed"` strictly requires `role="article"` children. Interactive controls (like "Load More" buttons) must reside *outside* the feed container to avoid `aria-required-children` violations.
**Action:** Verify mock structures for virtualized lists to ensure `axe-core` doesn't report false positives due to invalid child nesting in tests.
