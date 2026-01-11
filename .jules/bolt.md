## 2025-05-22 - Connected Leaf Components for High-Frequency Updates
**Learning:** Extracting high-frequency UI elements (like a video playhead) into small, self-connected components prevents their heavy parents from re-rendering on every update.
**Action:** Identify components that receive rapidly changing props (e.g., `currentTime`, `scrollPosition`) and extract the specific dynamic part into a separate component that subscribes directly to the store.
## 2025-05-22 - Video List Optimization
**Learning:** For lists of video elements, using `preload='metadata'` drastically reduces memory usage compared to default preloading. Interactive 'play-on-hover' provides a better UX than static thumbnails while maintaining performance.
**Action:** Apply `preload='metadata'` and `muted` to all list-based video components and implement hover-to-play patterns.
