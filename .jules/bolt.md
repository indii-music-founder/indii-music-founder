## 2024-05-22 - InfiniteCanvas Render Loop
**Learning:** `React.memo` is critical for children of components with high-frequency state updates (like drag/pan canvas loops).
**Action:** Always audit children of components that use `requestAnimationFrame` or high-frequency event handlers.

## 2025-01-28 - VideoTimeline High-Frequency Updates
**Learning:** High-frequency updates (playback time) at the root of a complex component (`VideoTimeline`) cause VDOM thrashing for all children (`TimelineTrack` list), even if children are memoized.
**Action:** Isolate high-frequency state into a leaf component (like `Playhead`) or extract the heavy static parts into a memoized container (`TrackList`) that ignores the changing prop.
