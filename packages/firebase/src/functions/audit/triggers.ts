import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { inngestEventKey } from '../../config/secrets';
import { getInngestClient } from '../../lib/inngestClient.js';
import type { CatalogAuditEventPayload } from './catalogAdminAudit';

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

export function buildAnalysisReceiptAuditPayload(
    receiptId: string,
    data: Record<string, unknown>,
): CatalogAuditEventPayload | undefined {
    if (data['status'] !== 'complete') return undefined;
    const userId = data['userId'];
    const contentHash = data['contentHash'];
    if (typeof userId !== 'string' || !userId || typeof contentHash !== 'string' || !contentHash) {
        return undefined;
    }
    return {
        userId,
        entityType: 'master',
        entityRefs: { masterHash: contentHash },
        receiptId,
    };
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
        const payload = buildAnalysisReceiptAuditPayload(event.params.receiptId, data);
        if (!payload) return;

        await getInngestClient().send({
            name: 'admin/audit.requested',
            data: payload,
            user: { id: payload.userId },
        });
    },
);
