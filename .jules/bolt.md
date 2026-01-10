## 2025-05-22 - Connected Leaf Components for High-Frequency Updates
**Learning:** Extracting high-frequency UI elements (like a video playhead) into small, self-connected components prevents their heavy parents from re-rendering on every update.
**Action:** Identify components that receive rapidly changing props (e.g., `currentTime`, `scrollPosition`) and extract the specific dynamic part into a separate component that subscribes directly to the store.
