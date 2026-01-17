## 2024-05-22 - [Lens Initialization]
**Learning:** Veo 3.1 generation is asynchronous and heavy. The "Pro" model can take 60s+ for high-quality stitching. Metadata validation is critical because the payload (pixels) is too large to inspect deeply in the client.
**Action:** Enforce strict metadata contracts (FPS, Duration, MIME) in tests. Use mocked signed URLs for playback.

## 2024-05-22 - [Veo Payload Validation]
**Learning:** `stitchVideoFn` was completing jobs without writing media metadata (resolution, fps, duration) to Firestore. This forced the client to guess or rely on implicit knowledge.
**Action:** Updated cloud functions to explicitly calculate and persist `metadata` block in the Firestore job document. Tests now assert on this contract.
