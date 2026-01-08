# Viewport Journal

## 2024-05-22 - [Initialization]
**Learning:** No responsive journal existed. Created one to track mobile-specific learnings.
**Action:** Consult this journal before writing new responsive tests.

## 2024-05-22 - [CommandBar Adaptation]
**Learning:** The CommandBar component aggressively hides features on mobile (Delegate, Attach, Camera) to preserve space. While effective for layout, it limits functionality (no file uploads on mobile).
**Action:** Future "Fat Finger" tests should verify that the remaining controls (Voice, Send) are spaced adequately since they are the only interaction points left.
