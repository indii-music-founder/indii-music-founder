import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { inngestEventKey } from '../../config/secrets';
import { getInngestClient } from '../../lib/inngestClient.js';

/**
 * Post-Mastering Administrative Engine triggers (P2; plan §2.2.1 / §3 T2).
 *
 * `onAnalysisReceiptComplete` closes the audit gap A-2: when engine-dsp marks
 * an `audio_analysis_receipts` document `complete`, the administrative chain
 * starts WITHOUT any user action — the receipt-complete event is dispatched to
 * the durable Inngest audit worker (`catalog-admin-audit`).
 *
 * The trigger itself stays thin: guards + dispatch only. All audit logic lives
 * in the worker so retries are durable and concurrency-bounded.
 */

export function buildAnalysisReceiptEvents(
    receiptId: string,
    data: Record<string, unknown>,
): Array<{ name: string; data: Record<string, unknown>; user: { id: string } }> {
    if (data['status'] !== 'complete') return [];
    const userId = data['userId'];
    const contentHash = data['contentHash'];
    if (typeof userId !== 'string' || !userId || typeof contentHash !== 'string' || !contentHash) {
        return [];
    }
    const events: Array<{ name: string; data: Record<string, unknown>; user: { id: string } }> = [
        {
            name: 'admin/audit.requested',
            data: { userId, entityType: 'master', entityRefs: { masterHash: contentHash }, receiptId },
            user: { id: userId },
        },
    ];
    // P4: the ingestion runbook drives the master lifecycle from this moment.
    if (typeof data['storagePath'] === 'string' && data['storagePath']) {
        events.push({
            name: 'admin/master.analyzed',
            data: {
                userId,
                masterHash: contentHash,
                receiptId,
                storagePath: data['storagePath'],
                generation: String(data['generation'] ?? '0'),
                masterFingerprint: typeof data['masterFingerprint'] === 'string' ? data['masterFingerprint'] : undefined,
            },
            user: { id: userId },
        });
    }
    return events;
}

export const onAnalysisReceiptComplete = onDocumentCreated(
    {
        document: 'audio_analysis_receipts/{receiptId}',
        secrets: [inngestEventKey],
        retry: false,
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;
        const data = (snapshot.data() ?? {}) as Record<string, unknown>;
        const events = buildAnalysisReceiptEvents(event.params.receiptId, data);
        if (events.length === 0) return;

        const client = getInngestClient();
        await client.send(events as never);
    },
);
