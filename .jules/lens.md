## 2024-05-22 - Veo 3.1 & Gemini 3 Integration
**Learning:** Veo 3.1 defines the physics, and the playback must respect its metadata contract.
**Action:** When testing, assert on `duration_seconds`, `fps` (24/30/60), and `mime_type` (video/mp4). Ensure timeouts are handled gracefully for Pro vs Flash models.

## 2024-05-22 - Test Environment Constraints
**Learning:** Veo files are huge.
**Action:** Use mocked signed URLs for video playback tests to avoid downloading 50MB files in CI.
