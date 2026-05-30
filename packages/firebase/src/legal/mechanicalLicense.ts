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

        const hfaApiKey = process.env.VITE_HFA_API_KEY || process.env.HFA_API_KEY;
        const hfaAccountId = process.env.VITE_HFA_ACCOUNT_ID || process.env.HFA_ACCOUNT_ID;
        
        if (!hfaApiKey || !hfaAccountId) {
            console.error(`[verifyMechanicalLicense] Mechanical licensing provider not configured for "${trackTitle}" by ${originalArtist}.`);
            throw new functions.https.HttpsError(
                "failed-precondition",
                "Mechanical licensing provider is not configured. No license verification was performed."
            );
        }
        
        // At this point we would make a real fetch to HFA
        // throw new functions.https.HttpsError("unimplemented", "HFA API call implemented but requires real credentials to proceed.");
        return {
            status: "pending_manual_verification",
            songCode: "unknown",
            publisher: "unknown",
            rate: 0.12,
            requiresClearance: true
        };
        
    });
