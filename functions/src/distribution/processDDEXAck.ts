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

import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';

/** DDEX ACK status codes → internal delivery status mapping */
const DDEX_ACK_STATUS_MAP: Record<string, string> = {
    'Acknowledged': 'live',
    'Accepted': 'live',
    'AcceptedWithChanges': 'live',
    'Rejected': 'failed',
    'ValidationFailed': 'failed',
    'UnknownRelease': 'failed',
    'Processing': 'processing',
    'InReview': 'in_review',
};

interface ParsedDDEXAck {
    messageId: string;
    releaseId: string;
    dealId?: string;
    dspId: string;
    ackCode: string;
    errorDescription?: string;
    processedAt: string;
    rawFileName: string;
}

/**
 * Parse DDEX ERN Acknowledgement XML.
 * Uses simple regex extraction — no full XML parser needed for this subset.
 */
function parseDDEXAckXML(xml: string, fileName: string): ParsedDDEXAck | null {
    try {
        const extract = (tag: string): string => {
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
            logger.warn(`[processDDEXAck] Could not extract key fields from ${fileName}`);
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
    } catch (err) {
        logger.error(`[processDDEXAck] XML parse failed for ${fileName}:`, err);
        return null;
    }
}

/**
 * Cloud Function: Triggers on new files landing in the ddex-acks/ folder in Cloud Storage.
 * Parses the DDEX ACK XML and updates the release delivery status in Firestore.
 */
export const processDDEXAck = onObjectFinalized({
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
}, async (event) => {
    const filePath = event.data.name;
    const bucket = event.data.bucket;

    // Only process files in the ddex-acks/ prefix
    if (!filePath || !filePath.startsWith('ddex-acks/')) {
        return;
    }

    // Only process XML files
    if (!filePath.endsWith('.xml') && !filePath.endsWith('.ack')) {
        logger.info(`[processDDEXAck] Skipping non-XML file: ${filePath}`);
        return;
    }

    logger.info(`[processDDEXAck] Processing ACK file: ${filePath}`);

    const db = getFirestore();
    const storage = getStorage();

    try {
        // Download ACK file content from Cloud Storage
        const fileRef = storage.bucket(bucket).file(filePath);
        const [contents] = await fileRef.download();
        const xmlContent = contents.toString('utf-8');

        // Parse the DDEX ACK XML
        const fileName = filePath.split('/').pop() ?? filePath;
        const parsed = parseDDEXAckXML(xmlContent, fileName);

        if (!parsed) {
            logger.error(`[processDDEXAck] Failed to parse ACK: ${filePath}`);
            return;
        }

        // Map DDEX ack code to internal delivery status
        const newDeliveryStatus = DDEX_ACK_STATUS_MAP[parsed.ackCode] ?? 'in_review';

        // Store parsed ACK in Firestore audit trail
        await db.collection('distribution_audit').add({
            type: 'ddex_ack',
            releaseId: parsed.releaseId,
            dealId: parsed.dealId ?? null,
            dspId: parsed.dspId,
            messageId: parsed.messageId,
            ackCode: parsed.ackCode,
            errorDescription: parsed.errorDescription ?? null,
            deliveryStatus: newDeliveryStatus,
            rawFilePath: filePath,
            processedAt: FieldValue.serverTimestamp(),
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

        let releaseRef: FirebaseFirestore.DocumentReference | null = null;
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
                    receivedAt: FieldValue.serverTimestamp(),
                    errorDescription: parsed.errorDescription ?? null,
                },
                updatedAt: FieldValue.serverTimestamp(),
            });
            logger.info(`[processDDEXAck] Release ${parsed.releaseId} status → ${newDeliveryStatus} (ACK: ${parsed.ackCode})`);
        } else {
            logger.warn(`[processDDEXAck] No release found for ID: ${parsed.releaseId}`);
        }

        // Move ACK file to processed/ folder to prevent reprocessing
        const processedPath = filePath.replace('ddex-acks/', 'ddex-acks/processed/');
        await fileRef.move(processedPath);
        logger.info(`[processDDEXAck] Moved ${filePath} → ${processedPath}`);

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error({
            message: '[processDDEXAck] Processing failed',
            filePath,
            errorCode: 'DDEX_ACK_FAILED',
            detail: errMsg,
        });
    }
});
