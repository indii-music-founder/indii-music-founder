---
description: How to stress test the Music Director module in the browser
---

# Live Test: Music Director

**Protocol for testing Audio Upload and Intelligence UI.**

## 1. Pre-Flight

* Confirm Dev Server (`localhost:4242`).
* Nav to **Music Director** (Sidebar).

## 2. Trigger

* Drag and drop or select an audio file (e.g., .wav, .mp3).
* Wait for the upload and analysis process to begin.

## 3. Verify

* **Visual:** Toast ("Audio analyzed successfully!") + waveform/analysis data appears and persists.
* **Console:** No Red/Uncaught errors.
* **Network:** No 500/400 on upload or analysis endpoints.

## 4. Debug (If Fail)

* Check `src/modules/music` or `src/services/audio`.
* Fix & Refresh.
