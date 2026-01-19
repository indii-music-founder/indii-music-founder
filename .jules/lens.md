# LENS'S JOURNAL - MEDIA INTEGRITY

## 2024-05-22 - [Lens Initialization]
**Learning:** Veo 3.1 generation is asynchronous and heavy. The "Pro" model can take 60s+ for high-quality stitching. Metadata validation is critical because the payload (pixels) is too large to inspect deeply in the client.
**Action:** Enforce strict metadata contracts (FPS, Duration, MIME) in tests. Use mocked signed URLs for playback.

## 2024-05-22 - [Veo Payload Validation]
**Learning:** `stitchVideoFn` was completing jobs without writing media metadata (resolution, fps, duration) to Firestore. This forced the client to guess or rely on implicit knowledge.
**Action:** Updated cloud functions to explicitly calculate and persist `metadata` block in the Firestore job document. Tests now assert on this contract.

## 2024-05-24 - [Veo 3.1 Metadata Contract]
**Learning:** The Veo 3.1 generation pipeline returns critical metadata (`duration_seconds`, `fps`, `mime_type`) in the `output` block of the job document. The frontend was previously discarding this data.
**Action:** Modified `VideoWorkflow` to capture this metadata and store it in the `HistoryItem`'s `meta` field. This ensures the "Contract" is preserved from generation to playback.
