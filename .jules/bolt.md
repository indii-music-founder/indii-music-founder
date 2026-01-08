## 2025-02-19 - Stable Arrays for Memoized Children
**Learning:** `React.memo` on a child component is ineffective if the parent passes a derived array (e.g., `.filter()`) directly in the render, as this creates a new reference every time.
**Action:** Always wrap derived data passed to memoized children in `useMemo` in the parent component, especially when the parent has high-frequency state updates (like video progress).
## 2024-05-22 - InfiniteCanvas Render Loop
**Learning:** `React.memo` is critical for children of components with high-frequency state updates (like drag/pan canvas loops).
**Action:** Always audit children of components that use `requestAnimationFrame` or high-frequency event handlers.

## 2025-01-28 - VideoTimeline High-Frequency Updates
**Learning:** High-frequency updates (playback time) at the root of a complex component (`VideoTimeline`) cause VDOM thrashing for all children (`TimelineTrack` list), even if children are memoized.
**Action:** Isolate high-frequency state into a leaf component (like `Playhead`) or extract the heavy static parts into a memoized container (`TrackList`) that ignores the changing prop.

## 2025-05-21 - Firestore List Rendering Anti-Pattern
**Learning:** React components (like `FeedItem`) inside lists driven by Firestore `onSnapshot` often re-render unnecessarily because `onSnapshot` creates new object references for every item on every update, breaking shallow equality checks in `React.memo`.
**Action:** When `React.memo` fails due to unstable object references from external stores, prefer caching expensive side-effects (like network requests) in the service layer (with LRU/TTL) over writing brittle custom comparators.
