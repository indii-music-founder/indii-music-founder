import * as functions from "firebase-functions/v1";
import { getPandaDocApiKey, pandaDocApiKey } from "../config/secrets";

const PANDADOC_API = "https://api.pandadoc.com/public/v1";

export const sendForDigitalSignature = functions
    .region("us-central1")
    .runWith({
        timeoutSeconds: 60,
        memory: "256MB",
        secrets: [pandaDocApiKey],
    })
    .https.onCall(async (data: Record<string, unknown>, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to request digital signatures."
            );
        }

        const { contractId, signers, provider } = data as { contractId: string; signers: Array<{ email: string }>; provider?: string };

        if (!contractId || !Array.isArray(signers)) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Missing 'contractId' or 'signers' array."
            );
        }

        const providerName = provider || "PandaDoc";
        if (providerName.toLowerCase() !== "pandadoc") {
            throw new functions.https.HttpsError(
                "failed-precondition",
                `Digital signature provider "${providerName}" is not configured.`
            );
        }

        console.log(`[sendForDigitalSignature] Initiating signature request via ${providerName} for contract ${contractId}`);

        const apiKey = getPandaDocApiKey();
        const response = await fetch(`${PANDADOC_API}/documents/${contractId}/send`, {
            method: "POST",
            headers: {
                "Authorization": `API-Key ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                subject: "Document ready for signature",
                message: "Please review and sign this document.",
                silent: false,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new functions.https.HttpsError(
                "internal",
                `PandaDoc signature request failed: ${response.status} ${error}`
            );
        }

        return {
            envelopeId: contractId,
            status: "sent",
            sentTo: signers.map((s: { email: string }) => s.email)
        };
    });
