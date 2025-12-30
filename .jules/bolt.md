## 2024-05-22 - InfiniteCanvas Render Loop
**Learning:** `React.memo` is critical for children of components with high-frequency state updates (like drag/pan canvas loops).
**Action:** Always audit children of components that use `requestAnimationFrame` or high-frequency event handlers.
