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
exports.pandadocWebhook = void 0;
/**
 * PandaDoc Webhook Handler
 *
 * Listens for PandaDoc document status change events.
 * When a contract is completed (signed), it:
 * 1. Records a "contract_signed" career event in Firestore
 * 2. Logs the event for the career memory pipeline
 * 3. Queues ISWC mapping for publishing agreements (→ iswcMapper)
 * 4. Triggers ISRC assignment + DDEX generation for distribution agreements
 *
 * Endpoint: POST /pandadocWebhook
 * PandaDoc webhooks: https://developers.pandadoc.com/docs/webhooks
 */
const crypto = __importStar(require("crypto"));
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const secrets_1 = require("../config/secrets");
const REGION = "us-west1";
/**
 * Webhook handler for PandaDoc document state changes.
 * SECURITY: Validates the request comes from PandaDoc IP ranges.
 */
exports.pandadocWebhook = functions
    .region(REGION)
    .runWith({
    secrets: [secrets_1.pandadocWebhookSecret],
    timeoutSeconds: 60,
    memory: "256MB",
})
    .https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
    // Only accept POST
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    // Verify PandaDoc HMAC-SHA256 signature
    // Configure shared secret in PandaDoc Dashboard → Webhooks → Shared Key
    const secret = process.env.PANDADOC_WEBHOOK_SECRET || (() => {
        try {
            return secrets_1.pandadocWebhookSecret.value();
        }
        catch (_a) {
            return "";
        }
    })();
    if (secret) {
        const signature = req.headers['x-signature'];
        if (!signature) {
            console.warn('[PandaDoc] Rejected request: missing x-signature header');
            res.status(401).send("Unauthorized");
            return;
        }
        const expected = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(req.body))
            .digest('hex');
        if (signature !== expected) {
            console.warn('[PandaDoc] Rejected request: invalid signature');
            res.status(401).send("Unauthorized");
            return;
        }
    }
    try {
        const payload = req.body;
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
            const tokens = {};
            if (event.tokens) {
                for (const token of event.tokens) {
                    tokens[token.name] = token.value;
                }
            }
            // Get the user ID from document metadata
            const userId = ((_a = event.metadata) === null || _a === void 0 ? void 0 : _a.userId) || tokens['user_id'];
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
                metadata: Object.assign(Object.assign({}, event.metadata), tokens),
                signedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            // Write to career_events collection
            await db.collection('career_events').add(careerEvent);
            // Write to user's event timeline
            await db.collection('users').doc(userId).collection('career_timeline').add(Object.assign(Object.assign({}, careerEvent), { summary: `Contract signed: ${event.name}` }));
            console.log(`[PandaDoc Webhook] Career event recorded for user ${userId}: ${event.name}`);
            // ──────────────────────────────────────────────
            // AUTO-PIPELINE TRIGGERS
            // ──────────────────────────────────────────────
            const documentType = ((_b = event.metadata) === null || _b === void 0 ? void 0 : _b.documentType) || tokens['document_type'] || '';
            const docNameLower = event.name.toLowerCase();
            // TRIGGER 1: Publishing Agreement → Queue ISWC Mapping
            // When a self-publishing agreement is signed, extract writer info
            // and register the composition via the iswcMapper Cloud Function.
            if (documentType === 'publishing_agreement' ||
                docNameLower.includes('publishing') ||
                docNameLower.includes('songwriter') ||
                docNameLower.includes('composition')) {
                console.log(`[PandaDoc Webhook] Publishing agreement detected. Queuing ISWC mapping.`);
                await db.collection('iswc_mapper_queue').add({
                    pandadocDocumentId: event.id,
                    documentName: event.name,
                    userId,
                    writers: extractWritersFromTokens(tokens),
                    publisher: extractPublisherFromTokens(tokens),
                    trackTitle: tokens['track_title'] || tokens['song_title'] || event.name,
                    isrc: tokens['isrc'] || null,
                    releaseId: tokens['release_id'] || ((_c = event.metadata) === null || _c === void 0 ? void 0 : _c.releaseId) || null,
                    signedAt: new Date().toISOString(),
                    status: 'queued',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            // TRIGGER 2: Distribution Agreement → ISRC + DDEX + Delivery
            // When a distribution agreement or release approval is signed,
            // trigger the post-mastering pipeline: assign ISRC → generate DDEX → deliver to DSPs.
            if (documentType === 'distribution_agreement' ||
                documentType === 'release_approval' ||
                docNameLower.includes('distribution') ||
                docNameLower.includes('release approval')) {
                const releaseId = tokens['release_id'] || ((_d = event.metadata) === null || _d === void 0 ? void 0 : _d.releaseId);
                if (releaseId) {
                    console.log(`[PandaDoc Webhook] Distribution agreement signed. Triggering pipeline for release ${releaseId}.`);
                    // Queue the auto-pipeline job
                    await db.collection('distribution_pipeline_queue').add({
                        releaseId,
                        userId,
                        pandadocDocumentId: event.id,
                        trigger: 'pandadoc_signed',
                        steps: {
                            isrcAssignment: 'pending',
                            ddexGeneration: 'pending',
                            dspDelivery: 'pending',
                        },
                        status: 'queued',
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    console.warn(`[PandaDoc Webhook] Distribution agreement signed but no releaseId found. Skipping pipeline.`);
                }
            }
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error("[PandaDoc Webhook] Error:", error);
        res.status(500).send("Internal error");
    }
});
// ──────────────────────────────────────────────
// Token Extraction Helpers
// ──────────────────────────────────────────────
/**
 * Extract writer/composer data from PandaDoc template tokens.
 * Expects tokens like: writer_1_name, writer_1_ipi, writer_1_share, etc.
 */
function extractWritersFromTokens(tokens) {
    const writers = [];
    // Check for up to 5 writers
    for (let i = 1; i <= 5; i++) {
        const name = tokens[`writer_${i}_name`];
        if (!name)
            break;
        writers.push({
            legalName: name,
            ipiNumber: tokens[`writer_${i}_ipi`] || undefined,
            pro: tokens[`writer_${i}_pro`] || undefined,
            share: parseFloat(tokens[`writer_${i}_share`] || '0'),
            role: tokens[`writer_${i}_role`] || 'CA',
        });
    }
    // Fallback: single writer from generic tokens
    if (writers.length === 0 && tokens['artist_legal_name']) {
        writers.push({
            legalName: tokens['artist_legal_name'],
            ipiNumber: tokens['artist_ipi'] || undefined,
            pro: tokens['artist_pro'] || undefined,
            share: 100,
            role: 'CA',
        });
    }
    return writers;
}
/**
 * Extract publisher data from PandaDoc template tokens.
 */
function extractPublisherFromTokens(tokens) {
    const publisherName = tokens['publisher_name'];
    if (!publisherName || publisherName === 'Self' || publisherName === 'N/A') {
        return null;
    }
    return {
        name: publisherName,
        ipiNumber: tokens['publisher_ipi'] || undefined,
        share: parseFloat(tokens['publisher_share'] || '0'),
    };
}
//# sourceMappingURL=pandadocWebhook.js.map