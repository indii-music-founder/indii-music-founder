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

        const { trackTitle, originalArtist, durationMs } = data as { trackTitle: string; originalArtist: string; durationMs?: number };

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
        
        try {
            const res = await fetch(`https://api.harryfox.com/v1/licenses/verify`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${hfaApiKey}`,
                    'X-Account-ID': hfaAccountId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ trackTitle, originalArtist, durationMs })
            });

            if (!res.ok) {
                 throw new Error(`HFA API returned ${res.status}`);
            }

            const hfaData = await res.json() as { isCleared?: boolean; songCode?: string; publisher?: string; rate?: number };
            return {
                status: hfaData.isCleared ? 'verified' : 'pending_manual_verification',
                songCode: hfaData.songCode || 'unknown',
                publisher: hfaData.publisher || 'unknown',
                rate: hfaData.rate || 0.12,
                requiresClearance: !hfaData.isCleared
            };
        } catch (error) {
            console.error('[verifyMechanicalLicense] HFA API failed:', error);
            throw new functions.https.HttpsError(
                "internal",
                "Failed to verify mechanical license with provider."
            );
        }
        
    });
