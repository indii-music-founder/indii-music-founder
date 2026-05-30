import * as functions from "firebase-functions/v1";

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

        console.error(`[verifyMechanicalLicense] Mechanical licensing provider not configured for "${trackTitle}" by ${originalArtist}.`);
        throw new functions.https.HttpsError(
            "failed-precondition",
            "Mechanical licensing provider is not configured. No license verification was performed."
        );
    });
