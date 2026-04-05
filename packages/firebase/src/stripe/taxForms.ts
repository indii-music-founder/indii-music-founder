import * as functions from "firebase-functions/v1";

export const requestTaxForms = functions
    .region("us-west1")
    .runWith({
        timeoutSeconds: 60,
        memory: "256MB"
    })
    .https.onCall(async (data: any, context) => {
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

        console.log(`[requestTaxForms] Initiating tax form request via Stripe/DocuSign for ${payees.length} payees`);

        // Process payees
        const requests = payees.map((p: any) => ({
            name: p.name,
            email: p.email,
            formTypeRequested: p.isUsPerson ? "W-9" : "W-8BEN",
            status: "Requested" // Mock dispatch
        }));

        return {
            requests
        };
    });
