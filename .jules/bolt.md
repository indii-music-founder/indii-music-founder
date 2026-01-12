## 2025-05-22 - Connected Leaf Components for High-Frequency Updates
**Learning:** Extracting high-frequency UI elements (like a video playhead) into small, self-connected components prevents their heavy parents from re-rendering on every update.
**Action:** Identify components that receive rapidly changing props (e.g., `currentTime`, `scrollPosition`) and extract the specific dynamic part into a separate component that subscribes directly to the store.
## 2025-05-22 - Video List Optimization
**Learning:** For lists of video elements, using `preload='metadata'` drastically reduces memory usage compared to default preloading. Interactive 'play-on-hover' provides a better UX than static thumbnails while maintaining performance.
**Action:** Apply `preload='metadata'` and `muted` to all list-based video components and implement hover-to-play patterns.
## 2025-05-22 - Firestore Snapshot Reference Instability
**Learning:** Firestore `onSnapshot` maps often create new object references for every document on every update (even unchanged ones). `React.memo`'s default shallow comparison fails here, causing full list re-renders.
**Action:** Implement `arePropsEqual` deep comparison for list items fed by Firestore subscriptions to skip renders when data content is identical despite reference changes.
