import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
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

        const { contractId, signers, provider } = data as { 
            contractId: string; 
            signers: Array<{ name: string; email: string; percentage: number }>; 
            provider?: string; 
        };

        if (!contractId || !Array.isArray(signers) || signers.length === 0) {
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

        console.log(`[sendForDigitalSignature] Initiating multi-party signature request via ${providerName} for contract ${contractId} with ${signers.length} signers.`);

        // Ownership gate (ISSUE-889): the caller's local contract record must
        // exist BEFORE any external PandaDoc call — the platform API key can
        // reach any document in the account, so contractId alone is not proof.
        const db = admin.firestore();
        const contractRef = db.doc(`users/${context.auth.uid}/contracts/${contractId}`);
        const existingSnap = await contractRef.get();
        if (!existingSnap.exists) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "Contract was not found for this user.",
            );
        }

        const apiKey = getPandaDocApiKey();

        // Standard PandaDoc API document creation and send flow for multi-recipients
        // We specify the recipients in the document creation or send payload
        const response = await fetch(`${PANDADOC_API}/documents/${contractId}/send`, {
            method: "POST",
            headers: {
                "Authorization": `API-Key ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                subject: "Split Sheet ready for signature",
                message: "Please review and sign this multi-party split sheet agreement.",
                silent: false,
                recipients: signers.map(s => ({
                    email: s.email,
                    name: s.name,
                    role: "signer"
                }))
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new functions.https.HttpsError(
                "internal",
                `PandaDoc signature request failed: ${response.status} ${error}`
            );
        }

        // Initialize multi-party signature tracking on the contract document in Firestore
        await contractRef.update({
            status: "sent_for_signing",
            signers: signers.map(s => ({
                name: s.name,
                email: s.email,
                percentage: s.percentage,
                status: "pending",
                signedAt: null
            })),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            envelopeId: contractId,
            status: "sent",
            sentTo: signers.map(s => s.email)
        };
    });
