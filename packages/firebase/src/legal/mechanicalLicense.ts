import * as functions from "firebase-functions/v1";

/**
 * verifyMechanicalLicense — Mechanical License Verification (NOT YET INTEGRATED)
 *
 * NOTE (ISSUE-300): The previous implementation called `https://api.harryfox.com/v1/licenses/verify`
 * which is a hallucinated endpoint. Harry Fox Agency (HFA) was acquired by MusicMark in 2021
 * and does not expose a public REST API at that URL. Calls would fail with 404/503.
 *
 * Integration path:
 *   1. Subscribe to MusicMark's licensing API program (https://www.musicmark.com)
 *   2. Obtain production credentials (API key + account ID)
 *   3. Implement against their documented endpoint schema
 *   4. Remove the NOT_IMPLEMENTED guard below
 *
 * Until that integration is complete, this function fails transparently so callers
 * can surface a clear "not available" state rather than silently returning bad data.
 */
export const verifyMechanicalLicense = functions
    .region("us-central1")
    .runWith({
        timeoutSeconds: 60,
        memory: "256MB"
    })
    .https.onCall(async (data: Record<string, unknown>, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to run verification."
            );
        }

        const { trackTitle, originalArtist } = data as { trackTitle: string; originalArtist: string };

        if (!trackTitle || !originalArtist) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Missing 'trackTitle' or 'originalArtist'."
            );
        }

        // ISSUE-300: MusicMark/HFA API integration not yet implemented.
        // Throw a documented not-yet-available error rather than calling a dead endpoint.
        console.warn(
            `[verifyMechanicalLicense] Mechanical license verification requested for ` +
            `"${trackTitle}" by ${originalArtist} — MusicMark integration not yet implemented.`
        );
        throw new functions.https.HttpsError(
            "unimplemented",
            "Mechanical license verification is not yet available. " +
            "MusicMark/HFA API integration is pending. Please verify manually."
        );
    });
