import { randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { arcjetKey, getPandaDocApiKey, pandaDocApiKey } from "../config/secrets";
import { validateAppCheckV2 } from "../middleware/appCheck";
import { protectAuthenticatedApiRequest } from "../functions/security/arcjet";

const PANDADOC_API = "https://api.pandadoc.com/public/v1";

export const sendForDigitalSignature = onCall(
    {
        region: "us-central1",
        timeoutSeconds: 60,
        secrets: [pandaDocApiKey, arcjetKey],
        enforceAppCheck: true,
        memory: "512MiB",
        cpu: "gcf_gen1",
        concurrency: 1,
    },
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth?.uid) {
            throw new HttpsError(
                "unauthenticated",
                "User must be authenticated to request digital signatures."
            );
        }
        if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
        }
        if (request.auth.token?.email_verified === false) {
            throw new HttpsError('permission-denied', 'Verified email is required.');
        }

        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: request.auth.uid,
                policy: 'verified-free',
                operationId: `send-for-digital-signature:${randomUUID()}`,
            });
            if (!protection.allowed) {
                throw new HttpsError(
                    protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                    protection.message,
                );
            }
        }

        const { contractId, signers, provider } = (request.data ?? {}) as {
            contractId: string; 
            signers: Array<{ name: string; email: string; percentage: number }>; 
            provider?: string; 
        };

        if (!contractId || !Array.isArray(signers) || signers.length === 0) {
            throw new HttpsError(
                "invalid-argument",
                "Missing 'contractId' or 'signers' array."
            );
        }

        const providerName = provider || "PandaDoc";
        if (providerName.toLowerCase() !== "pandadoc") {
            throw new HttpsError(
                "failed-precondition",
                `Digital signature provider "${providerName}" is not configured.`
            );
        }

        console.log(`[sendForDigitalSignature] Initiating multi-party signature request via ${providerName} for contract ${contractId} with ${signers.length} signers.`);

        // Ownership gate (ISSUE-889): the caller's local contract record must
        // exist BEFORE any external PandaDoc call — the platform API key can
        // reach any document in the account, so contractId alone is not proof.
        const db = admin.firestore();
        const contractRef = db.doc(`users/${request.auth.uid}/contracts/${contractId}`);
        const existingSnap = await contractRef.get();
        if (!existingSnap.exists) {
            throw new HttpsError(
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
            throw new HttpsError(
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
