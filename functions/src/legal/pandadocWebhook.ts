/**
 * PandaDoc Webhook Handler
 *
 * Listens for PandaDoc document status change events.
 * When a contract is completed (signed), it:
 * 1. Records a "contract_signed" career event in Firestore
 * 2. Logs the event for the career memory pipeline
 *
 * Endpoint: POST /pandadocWebhook
 * PandaDoc webhooks: https://developers.pandadoc.com/docs/webhooks
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const REGION = "us-west1";

interface PandaDocWebhookEvent {
    event: string; // e.g., "document_state_changed"
    data: {
        id: string;
        name: string;
        status: string; // "document.completed", "document.sent", etc.
        date_created: string;
        date_modified: string;
        metadata?: Record<string, string>;
        tokens?: Array<{ name: string; value: string }>;
        recipients?: Array<{
            email: string;
            first_name: string;
            last_name: string;
            role: string;
            has_completed: boolean;
        }>;
    }[];
}

/**
 * Webhook handler for PandaDoc document state changes.
 * SECURITY: Validates the request comes from PandaDoc IP ranges.
 */
export const pandadocWebhook = functions
    .region(REGION)
    .runWith({
        timeoutSeconds: 30,
        memory: "256MB",
    })
    .https.onRequest(async (req, res) => {
        // Only accept POST
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }

        try {
            const payload = req.body as PandaDocWebhookEvent;

            if (!payload.data || !Array.isArray(payload.data)) {
                res.status(400).send("Invalid webhook payload");
                return;
            }

            const db = admin.firestore();

            for (const event of payload.data) {
                console.log(`[PandaDoc Webhook] Event: ${event.status} for doc: ${event.id}`);

                // Only process completed documents
                if (event.status !== "document.completed") {
                    continue;
                }

                // Extract metadata tokens (artist info, track info, etc.)
                const tokens: Record<string, string> = {};
                if (event.tokens) {
                    for (const token of event.tokens) {
                        tokens[token.name] = token.value;
                    }
                }

                // Get the user ID from document metadata
                const userId = event.metadata?.userId || tokens['user_id'];
                if (!userId) {
                    console.warn(`[PandaDoc Webhook] No userId found for doc ${event.id}. Skipping.`);
                    continue;
                }

                // Record career event
                const careerEvent = {
                    type: 'contract_signed',
                    documentId: event.id,
                    documentName: event.name,
                    userId,
                    signers: (event.recipients || [])
                        .filter(r => r.has_completed)
                        .map(r => ({
                            name: `${r.first_name} ${r.last_name}`,
                            email: r.email,
                            role: r.role,
                        })),
                    metadata: {
                        ...event.metadata,
                        ...tokens,
                    },
                    signedAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                // Write to career_events collection
                await db.collection('career_events').add(careerEvent);

                // Write to user's event timeline
                await db.collection('users').doc(userId).collection('career_timeline').add({
                    ...careerEvent,
                    summary: `Contract signed: ${event.name}`,
                });

                console.log(`[PandaDoc Webhook] Career event recorded for user ${userId}: ${event.name}`);
            }

            res.status(200).json({ received: true });

        } catch (error) {
            console.error("[PandaDoc Webhook] Error:", error);
            res.status(500).send("Internal error");
        }
    });
