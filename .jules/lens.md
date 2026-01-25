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

## 2026-01-24 - [Veo 3.1 Quality Tier Protection]
**Learning:** `VideoGenerationService` implements client-side protection against out-of-order packet delivery where a delayed "Flash" (low quality) update could overwrite a "Pro" (high quality) result.
**Action:** Enhanced `LensVeoFlashProRace.test.ts` to verify:
- **Out-of-Order Protection:** Service ignores "Flash" updates if "Pro" metadata (Quality Level 2) has already been processed for the same job.
- **Upgrade Continuity:** Service correctly accepts "Pro" updates even after "Flash" has been rendered, ensuring the user gets the best available quality.

## 2026-01-26 - [Veo 3.1 Aspect Ratio Compliance]
**Learning:** Veo 3.1 generation pipeline must strictly adhere to aspect ratio constraints, especially for distributor-specific formats like Spotify Canvas (9:16). Explicit user overrides must take precedence over distributor defaults.
**Action:** Implemented `LensVeoAspectRatio.test.ts` to verify:
- **Explicit 16:9:** Requests are correctly passed to the backend.
- **Distributor Fallback:** Users with "DistroKid" get automatic 9:16 (Canvas) defaults.
- **User Override:** Users can force 16:9 even if their distributor suggests otherwise.
