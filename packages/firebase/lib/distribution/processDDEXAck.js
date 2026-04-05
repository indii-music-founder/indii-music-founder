"use strict";
/**
 * Firebase Cloud Function: Process DDEX DSP Acknowledgement
 *
 * Item 415: After a DDEX ERN delivery, DSPs send back acknowledgement messages
 * confirming ingestion success or reporting errors. This function:
 *   1. Triggers when a new ACK file lands in gs://<bucket>/ddex-acks/
 *   2. Parses the inbound DDEX ERN acknowledgement XML
 *   3. Updates the corresponding release delivery status in Firestore
 *   4. Stores parsed ACK data for audit trail
 *
 * ACK files from DSPs use the DDEX ERN Acknowledgement Message (ERN-A) format.
 * Key fields extracted: MessageId, DealId/ReleaseId, AcknowledgementCode, ErrorDescription
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDDEXAck = void 0;
const storage_1 = require("firebase-functions/v2/storage");
const firestore_1 = require("firebase-admin/firestore");
const storage_2 = require("firebase-admin/storage");
const firebase_functions_1 = require("firebase-functions");
/** DDEX ACK status codes → internal delivery status mapping */
const DDEX_ACK_STATUS_MAP = {
    'Acknowledged': 'live',
    'Accepted': 'live',
    'AcceptedWithChanges': 'live',
    'Rejected': 'failed',
    'ValidationFailed': 'failed',
    'UnknownRelease': 'failed',
    'Processing': 'processing',
    'InReview': 'in_review',
};
/**
 * Parse DDEX ERN Acknowledgement XML.
 * Uses simple regex extraction — no full XML parser needed for this subset.
 */
function parseDDEXAckXML(xml, fileName) {
    try {
        const extract = (tag) => {
            const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`));
            return match ? match[1].trim() : '';
        };
        const messageId = extract('MessageId') || extract('MessageID');
        const releaseId = extract('ReleaseId') || extract('ReleaseID') || extract('ProprietaryId');
        const dealId = extract('DealId') || extract('DealID') || undefined;
        const dspId = extract('MessageSenderId') || extract('PartyId') || 'unknown';
        const ackCode = extract('AcknowledgementCode') || extract('AcknowledgementType') || 'Processing';
        const errorDescription = extract('ErrorDescription') || extract('ReasonDescription') || undefined;
        if (!messageId && !releaseId) {
            firebase_functions_1.logger.warn(`[processDDEXAck] Could not extract key fields from ${fileName}`);
            return null;
        }
        return {
            messageId,
            releaseId,
            dealId,
            dspId,
            ackCode,
            errorDescription,
            processedAt: new Date().toISOString(),
            rawFileName: fileName,
        };
    }
    catch (err) {
        firebase_functions_1.logger.error(`[processDDEXAck] XML parse failed for ${fileName}:`, err);
        return null;
    }
}
/**
 * Cloud Function: Triggers on new files landing in the ddex-acks/ folder in Cloud Storage.
 * Parses the DDEX ACK XML and updates the release delivery status in Firestore.
 */
exports.processDDEXAck = (0, storage_1.onObjectFinalized)({
    bucket: "indiios-alpha-electron",
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
}, async (event) => {
    var _a, _b, _c, _d, _e;
    const filePath = event.data.name;
    const bucket = event.data.bucket;
    // Only process files in the ddex-acks/ prefix
    if (!filePath || !filePath.startsWith('ddex-acks/')) {
        return;
    }
    // Only process XML files
    if (!filePath.endsWith('.xml') && !filePath.endsWith('.ack')) {
        firebase_functions_1.logger.info(`[processDDEXAck] Skipping non-XML file: ${filePath}`);
        return;
    }
    firebase_functions_1.logger.info(`[processDDEXAck] Processing ACK file: ${filePath}`);
    const db = (0, firestore_1.getFirestore)();
    const storage = (0, storage_2.getStorage)();
    try {
        // Download ACK file content from Cloud Storage
        const fileRef = storage.bucket(bucket).file(filePath);
        const [contents] = await fileRef.download();
        const xmlContent = contents.toString('utf-8');
        // Parse the DDEX ACK XML
        const fileName = (_a = filePath.split('/').pop()) !== null && _a !== void 0 ? _a : filePath;
        const parsed = parseDDEXAckXML(xmlContent, fileName);
        if (!parsed) {
            firebase_functions_1.logger.error(`[processDDEXAck] Failed to parse ACK: ${filePath}`);
            return;
        }
        // Map DDEX ack code to internal delivery status
        const newDeliveryStatus = (_b = DDEX_ACK_STATUS_MAP[parsed.ackCode]) !== null && _b !== void 0 ? _b : 'in_review';
        // Store parsed ACK in Firestore audit trail
        await db.collection('distribution_audit').add({
            type: 'ddex_ack',
            releaseId: parsed.releaseId,
            dealId: (_c = parsed.dealId) !== null && _c !== void 0 ? _c : null,
            dspId: parsed.dspId,
            messageId: parsed.messageId,
            ackCode: parsed.ackCode,
            errorDescription: (_d = parsed.errorDescription) !== null && _d !== void 0 ? _d : null,
            deliveryStatus: newDeliveryStatus,
            rawFilePath: filePath,
            processedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Update the release delivery status in Firestore
        // Try to find the release by releaseId or dealId
        const queries = [
            db.collection('releases').where('releaseId', '==', parsed.releaseId).limit(1),
            db.collection('releases').where('ddexDealId', '==', parsed.releaseId).limit(1),
        ];
        if (parsed.dealId) {
            queries.push(db.collection('releases').where('ddexDealId', '==', parsed.dealId).limit(1));
        }
        let releaseRef = null;
        for (const q of queries) {
            const snap = await q.get();
            if (!snap.empty) {
                releaseRef = snap.docs[0].ref;
                break;
            }
        }
        if (releaseRef) {
            await releaseRef.update({
                deliveryStatus: newDeliveryStatus,
                lastDSPAck: {
                    ackCode: parsed.ackCode,
                    dspId: parsed.dspId,
                    receivedAt: firestore_1.FieldValue.serverTimestamp(),
                    errorDescription: (_e = parsed.errorDescription) !== null && _e !== void 0 ? _e : null,
                },
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            firebase_functions_1.logger.info(`[processDDEXAck] Release ${parsed.releaseId} status → ${newDeliveryStatus} (ACK: ${parsed.ackCode})`);
        }
        else {
            firebase_functions_1.logger.warn(`[processDDEXAck] No release found for ID: ${parsed.releaseId}`);
        }
        // Move ACK file to processed/ folder to prevent reprocessing
        const processedPath = filePath.replace('ddex-acks/', 'ddex-acks/processed/');
        await fileRef.move(processedPath);
        firebase_functions_1.logger.info(`[processDDEXAck] Moved ${filePath} → ${processedPath}`);
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        firebase_functions_1.logger.error({
            message: '[processDDEXAck] Processing failed',
            filePath,
            errorCode: 'DDEX_ACK_FAILED',
            detail: errMsg,
        });
    }
});
//# sourceMappingURL=processDDEXAck.js.map