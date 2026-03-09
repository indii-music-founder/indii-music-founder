/**
 * PandaDoc Cloud Function Proxy
 *
 * Secures the PandaDoc API key by keeping it server-side.
 * All PandaDoc operations are proxied through these callable functions.
 *
 * The client-side PandaDocService calls these instead of hitting
 * the PandaDoc API directly with a VITE_-prefixed key.
 */
import * as functions from "firebase-functions/v1";
import { getPandaDocApiKey, pandaDocApiKey } from "../config/secrets";

const PANDADOC_API = "https://api.pandadoc.com/public/v1";

// Common enforcements
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === "true";
const REGION = "us-west1";

function getHeaders(apiKey: string): Record<string, string> {
    return {
        "Authorization": `API-Key ${apiKey}`,
        "Content-Type": "application/json",
    };
}

/**
 * List available PandaDoc document templates.
 */
export const pandadocListTemplates = functions
    .region(REGION)
    .runWith({
        timeoutSeconds: 30,
        memory: "256MB",
        enforceAppCheck: ENFORCE_APP_CHECK,
        secrets: [pandaDocApiKey],
    })
    .https.onCall(async (_data: unknown, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
        }

        const apiKey = getPandaDocApiKey();
        const response = await fetch(`${PANDADOC_API}/templates`, {
            headers: getHeaders(apiKey),
        });

        if (!response.ok) {
            throw new functions.https.HttpsError("internal", `PandaDoc templates error: ${response.status}`);
        }

        const data = await response.json();
        return (data.results || []).map((t: Record<string, unknown>) => ({
            id: t.id as string,
            name: t.name as string,
            dateCreated: t.date_created as string,
            version: (t.version as string) || "1",
        }));
    });

/**
 * Create a new document from a PandaDoc template.
 */
export const pandadocCreateDocument = functions
    .region(REGION)
    .runWith({
        timeoutSeconds: 60,
        memory: "256MB",
        enforceAppCheck: ENFORCE_APP_CHECK,
        secrets: [pandaDocApiKey],
    })
    .https.onCall(async (data: unknown, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
        }

        const input = data as {
            name: string;
            templateId?: string;
            recipients: Array<{
                email: string;
                firstName: string;
                lastName: string;
                role: string;
                signingOrder?: number;
            }>;
            tokens?: Record<string, string>;
            metadata?: Record<string, string>;
            tags?: string[];
        };

        if (!input.name || !input.recipients?.length) {
            throw new functions.https.HttpsError("invalid-argument", "name and recipients are required.");
        }

        const apiKey = getPandaDocApiKey();
        const body = {
            name: input.name,
            template_uuid: input.templateId,
            recipients: input.recipients.map((r) => ({
                email: r.email,
                first_name: r.firstName,
                last_name: r.lastName,
                role: r.role,
                signing_order: r.signingOrder,
            })),
            tokens: input.tokens
                ? Object.entries(input.tokens).map(([k, v]) => ({ name: k, value: v }))
                : [],
            metadata: input.metadata,
            tags: input.tags,
        };

        const response = await fetch(`${PANDADOC_API}/documents`, {
            method: "POST",
            headers: getHeaders(apiKey),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new functions.https.HttpsError("internal", `PandaDoc create error: ${response.status} — ${error}`);
        }

        const doc = await response.json();
        return {
            id: doc.id,
            name: doc.name,
            status: doc.status,
            dateCreated: doc.date_created,
            dateModified: doc.date_modified,
            recipients: input.recipients,
        };
    });

/**
 * Send a document for e-signature.
 */
export const pandadocSendDocument = functions
    .region(REGION)
    .runWith({
        timeoutSeconds: 30,
        memory: "256MB",
        enforceAppCheck: ENFORCE_APP_CHECK,
        secrets: [pandaDocApiKey],
    })
    .https.onCall(async (data: unknown, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
        }

        const input = data as { documentId: string; message?: string; subject?: string };
        if (!input.documentId) {
            throw new functions.https.HttpsError("invalid-argument", "documentId is required.");
        }

        const apiKey = getPandaDocApiKey();
        const response = await fetch(`${PANDADOC_API}/documents/${input.documentId}/send`, {
            method: "POST",
            headers: getHeaders(apiKey),
            body: JSON.stringify({
                message: input.message || "Please review and sign",
                subject: input.subject || "Document ready for signature",
                silent: false,
            }),
        });

        if (!response.ok) {
            throw new functions.https.HttpsError("internal", `PandaDoc send error: ${response.status}`);
        }

        return { success: true };
    });

/**
 * Get the current status of a document.
 */
export const pandadocGetDocumentStatus = functions
    .region(REGION)
    .runWith({
        timeoutSeconds: 30,
        memory: "256MB",
        enforceAppCheck: ENFORCE_APP_CHECK,
        secrets: [pandaDocApiKey],
    })
    .https.onCall(async (data: unknown, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
        }

        const input = data as { documentId: string };
        if (!input.documentId) {
            throw new functions.https.HttpsError("invalid-argument", "documentId is required.");
        }

        const apiKey = getPandaDocApiKey();
        const response = await fetch(`${PANDADOC_API}/documents/${input.documentId}`, {
            headers: getHeaders(apiKey),
        });

        if (!response.ok) {
            throw new functions.https.HttpsError("internal", `PandaDoc status error: ${response.status}`);
        }

        const doc = await response.json();
        return {
            id: doc.id,
            name: doc.name,
            status: doc.status,
            dateCreated: doc.date_created,
            dateModified: doc.date_modified,
            expirationDate: doc.expiration_date,
            recipients: (doc.recipients || []).map((r: Record<string, unknown>) => ({
                email: r.email as string,
                firstName: r.first_name as string,
                lastName: r.last_name as string,
                role: r.role as string,
            })),
        };
    });

/**
 * Generate a shareable signing link for a recipient.
 */
export const pandadocGetSigningLink = functions
    .region(REGION)
    .runWith({
        timeoutSeconds: 30,
        memory: "256MB",
        enforceAppCheck: ENFORCE_APP_CHECK,
        secrets: [pandaDocApiKey],
    })
    .https.onCall(async (data: unknown, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
        }

        const input = data as { documentId: string; recipientId: string };
        if (!input.documentId || !input.recipientId) {
            throw new functions.https.HttpsError("invalid-argument", "documentId and recipientId are required.");
        }

        const apiKey = getPandaDocApiKey();
        const response = await fetch(
            `${PANDADOC_API}/documents/${input.documentId}/session`,
            {
                method: "POST",
                headers: getHeaders(apiKey),
                body: JSON.stringify({ recipient: input.recipientId }),
            }
        );

        if (!response.ok) {
            throw new functions.https.HttpsError("internal", `PandaDoc session error: ${response.status}`);
        }

        const result = await response.json();
        return {
            id: result.id,
            url: result.url || `https://app.pandadoc.com/s/${result.id}`,
            expiresAt: result.expires_at,
        };
    });
