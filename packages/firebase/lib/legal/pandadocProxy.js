"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pandadocGetSigningLink = exports.pandadocGetDocumentStatus = exports.pandadocSendDocument = exports.pandadocCreateDocument = exports.pandadocListTemplates = void 0;
/**
 * PandaDoc Cloud Function Proxy
 *
 * Secures the PandaDoc API key by keeping it server-side.
 * All PandaDoc operations are proxied through these callable functions.
 *
 * The client-side PandaDocService calls these instead of hitting
 * the PandaDoc API directly with a VITE_-prefixed key.
 */
const functions = __importStar(require("firebase-functions/v1"));
const secrets_1 = require("../config/secrets");
const PANDADOC_API = "https://api.pandadoc.com/public/v1";
// Common enforcements
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === "true";
const REGION = "us-west1";
function getHeaders(apiKey) {
    return {
        "Authorization": `API-Key ${apiKey}`,
        "Content-Type": "application/json",
    };
}
/**
 * List available PandaDoc document templates.
 */
exports.pandadocListTemplates = functions
    .region(REGION)
    .runWith({
    timeoutSeconds: 30,
    memory: "256MB",
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [secrets_1.pandaDocApiKey],
})
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const apiKey = (0, secrets_1.getPandaDocApiKey)();
    const response = await fetch(`${PANDADOC_API}/templates`, {
        headers: getHeaders(apiKey),
    });
    if (!response.ok) {
        throw new functions.https.HttpsError("internal", `PandaDoc templates error: ${response.status}`);
    }
    const data = await response.json();
    return (data.results || []).map((t) => ({
        id: t.id,
        name: t.name,
        dateCreated: t.date_created,
        version: t.version || "1",
    }));
});
/**
 * Create a new document from a PandaDoc template.
 */
exports.pandadocCreateDocument = functions
    .region(REGION)
    .runWith({
    timeoutSeconds: 60,
    memory: "256MB",
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [secrets_1.pandaDocApiKey],
})
    .https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const input = data;
    if (!input.name || !((_a = input.recipients) === null || _a === void 0 ? void 0 : _a.length)) {
        throw new functions.https.HttpsError("invalid-argument", "name and recipients are required.");
    }
    const apiKey = (0, secrets_1.getPandaDocApiKey)();
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
exports.pandadocSendDocument = functions
    .region(REGION)
    .runWith({
    timeoutSeconds: 30,
    memory: "256MB",
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [secrets_1.pandaDocApiKey],
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const input = data;
    if (!input.documentId) {
        throw new functions.https.HttpsError("invalid-argument", "documentId is required.");
    }
    const apiKey = (0, secrets_1.getPandaDocApiKey)();
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
exports.pandadocGetDocumentStatus = functions
    .region(REGION)
    .runWith({
    timeoutSeconds: 30,
    memory: "256MB",
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [secrets_1.pandaDocApiKey],
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const input = data;
    if (!input.documentId) {
        throw new functions.https.HttpsError("invalid-argument", "documentId is required.");
    }
    const apiKey = (0, secrets_1.getPandaDocApiKey)();
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
        recipients: (doc.recipients || []).map((r) => ({
            email: r.email,
            firstName: r.first_name,
            lastName: r.last_name,
            role: r.role,
        })),
    };
});
/**
 * Generate a shareable signing link for a recipient.
 */
exports.pandadocGetSigningLink = functions
    .region(REGION)
    .runWith({
    timeoutSeconds: 30,
    memory: "256MB",
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [secrets_1.pandaDocApiKey],
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const input = data;
    if (!input.documentId || !input.recipientId) {
        throw new functions.https.HttpsError("invalid-argument", "documentId and recipientId are required.");
    }
    const apiKey = (0, secrets_1.getPandaDocApiKey)();
    const response = await fetch(`${PANDADOC_API}/documents/${input.documentId}/session`, {
        method: "POST",
        headers: getHeaders(apiKey),
        body: JSON.stringify({ recipient: input.recipientId }),
    });
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
//# sourceMappingURL=pandadocProxy.js.map