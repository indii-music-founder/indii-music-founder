# Mega Stress Test V10.0 (API and Security Hardening Regression)

Validating fixes related to API key retrieval, Cloud Storage payload limits, UI gating for unconfigured endpoints, Cloud Functions secret management, and Firestore security rules.

## Section 1: Security & Secrets Hardening
Routine 5. **API Key Fallback Verification (ISSUE-090):** Start the application. Verify that Gemini API requests properly fallback to `VITE_API_KEY` without crashing due to undefined lookups in `FallbackClient.ts`.
Routine 6. **Cloud Functions Vertex ADC Fallback (ISSUE-093):** Deploy the application to Firebase (or use local emulators). Verify that background functions using the Gemini model do not crash when `GEMINI_API_KEY` is missing in the secret manager, but gracefully fallback to Vertex ADC.

## Section 2: Storage & Media Limits
Routine 7. **Campaign Image Storage (ISSUE-091):** In the Marketing Department, prompt the agent to generate a campaign with images. Verify that the image is uploaded to Cloud Storage and a URL is returned, rather than crashing the client with a base64 payload size limit error.

## Section 3: UI Resilience
Routine 8. **OmniWorkflow Graceful Degradation (ISSUE-092):** Navigate to OmniWorkflow (or try generating an Omni Remix). Ensure that if the backend is not configured for API use, an "API UNAVAILABLE" toast appears and the UI does not lock up permanently.

## Section 4: Database Security
Routine 9. **Firestore Rules Compilation (ISSUE-094):** Run a test write to a protected Firestore collection (e.g. creating a new document owned by the user). Ensure the write succeeds and does not fail due to a compilation error in `firestore.rules` (which previously had undefined `isOwnerWrite`).

## Pass/Fail Criteria
| Result | Definition |
|--------|------------|
| ✅ PASS | The scenario executes exactly as described with no console errors or hard crashes. |
| ⚠️ PARTIAL | The scenario completes but with warnings or degraded UX. |
| ❌ FAIL | The scenario crashes, throws unhandled exceptions, or blocks the user completely. |

## Execution Notes
- Run against production build AND dev build separately.
- Console errors are disqualifying for all sections.
- For any ❌ FAIL, add a REGRESSION entry to OPEN_ISSUES.md.
