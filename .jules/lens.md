## 2024-05-23 - Veo 3.1 Metadata & Safety Validation
**Learning:** `VideoGenerationService` validation for Veo 3.1 must explicitly assert `duration_seconds`, `fps` (24/30/60), and `mime_type` on the job output, as the service itself does not parse these fields.
**Action:** Implemented `VideoGenerationService.test.ts` with strict metadata assertions and safety violation checks to ensure the app handles Veo's "completed" and "failed" states correctly without manual retries.
