# Lens's Journal 🎥

## 2024-05-23 - [Lens Setup]
**Learning:** Initialized Lens persona for media integrity verification.
**Action:** Created journal to track critical Veo 3.1 and Gemini 3 Native Generation learnings.

## 2026-01-20 - [Veo 3.1 Compliance]
**Learning:** Veo 3.1 introduces a strict "Flash" vs "Pro" generation tiering and rigorous metadata contracts.
**Action:** Implemented `LensVeoCompliance.test.ts` to enforce:
- **Metadata Integrity:** `duration_seconds`, `fps` (24/30/60), and `mime_type` ('video/mp4') must be present.
- **MIME Type Guard:** Service now strictly rejects non-video assets (e.g. static images from Gemini fallback) via `waitForJob` validation.
- **Generation Speed:** Benchmarks established for Flash (<2s) and Pro (<30s).
- **Upgrade Path:** Verified that subscriptions correctly handle the Flash -> Pro quality upgrade event sequence.

## 2026-01-22 - [Veo 3.1 Resilience & Race Conditions]
**Learning:** The "Safety Filter" in Veo 3.1 returns a specific error structure (`stitchError` with `SAFETY_VIOLATION`) that must be gracefully handled by the UI toast system, not crashing the player.
**Action:** Implemented "Scenario 2" in `VideoWorkflow.veo.test.tsx` to verify:
- **Safety Handshake:** UI correctly identifies `SAFETY_VIOLATION` and shows a specific error toast.
- **Flash vs Pro Race:** Confirmed that rapid job ID switching (due to user triggering Flash generation) correctly cleans up previous "Pro" subscriptions, preventing stale state updates.
