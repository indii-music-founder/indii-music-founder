import * as functions from "firebase-functions/v1";

export const requestTaxForms = functions
    .region("us-central1")
    .runWith({
        timeoutSeconds: 60,
        memory: "256MB"
    })
    .https.onCall(async (data: { payees?: unknown[] }, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to request tax forms."
            );
        }

        const { payees } = data;

        if (!payees || !Array.isArray(payees)) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Missing 'payees' array."
            );
        }

        console.error(`[requestTaxForms] Tax form provider not configured. Refusing to report ${payees.length} requests as sent.`);
        throw new functions.https.HttpsError(
            "failed-precondition",
            "Tax form provider is not configured. No tax form requests were sent."
        );
    });
