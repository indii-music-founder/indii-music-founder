import { db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { logger } from '@/utils/logger';

/**
 * Item 244: Immutable Legal Audit Trail
 *
 * Records all significant legal actions (signature requests, completions,
 * rejections, template changes) in a central, append-only collection.
 *
 * Firestore Security Rules MUST restrict this collection to:
 * - create: true (if authenticated)
 * - update: false (IMMUTABLE)
 * - delete: false (APPEND-ONLY)
 */

export type LegalActionType =
    | 'CONTRACT_DRAFTED'
    | 'SIGNATURE_REQUESTED'
    | 'SIGNATURE_COMPLETED'
    | 'SIGNATURE_REJECTED'
    | 'TEMPLATE_VERSION_PUBLISHED'
    | 'COPYRIGHT_REGISTERED'
    | 'SPLIT_SHEET_EXECUTED';

export interface LegalAuditRecord {
    id?: string;
    actionType: LegalActionType;
    actorUid: string;       // Who performed the action
    targetId: string;       // Contract/Release/Template ID affected
    targetType: 'contract' | 'release' | 'template' | 'user';
    metadata: Record<string, string | number | boolean>;
    ipAddress?: string;     // Collected securely via Cloud Function in prod
    userAgent?: string;
    timestamp: Timestamp;
}

export class LegalAuditService {
    /**
     * Record a new event in the immutable legal audit ledger.
     */
    static async recordEvent(
        actionType: LegalActionType,
        actorUid: string,
        targetId: string,
        targetType: LegalAuditRecord['targetType'],
        metadata: Record<string, string | number | boolean> = {}
    ): Promise<string> {
        try {
            const auditRef = collection(db, 'legal_audit_ledger');

            // In a production environment, IP/UserAgent should be captured securely
            // on the backend via a Callable Cloud Function to prevent spoofing.
            // This client implementation acts as the interface.

            const docRef = await addDoc(auditRef, {
                actionType,
                actorUid,
                targetId,
                targetType,
                metadata,
                userAgent: navigator.userAgent,
                timestamp: serverTimestamp(),
            });

            logger.info(`[LegalAudit] Recorded event: ${actionType} on ${targetType} ${targetId}`);
            return docRef.id;
        } catch (error) {
            // Critical failure — legal actions should theoretically block if auditing fails
            logger.error(`[LegalAudit] FAILED to record event: ${actionType}`, error);
            throw new Error(`Failed to record legal audit trail: ${error}`);
        }
    }

    /**
     * Retrieve the audit history for a specific target (e.g., a specific contract)
     */
    static async getHistoryForTarget(targetId: string, targetType: LegalAuditRecord['targetType'], maxResults = 50): Promise<LegalAuditRecord[]> {
        // Note: Requires a composite index on (targetId, targetType, timestamp DESC)
        const auditRef = collection(db, 'legal_audit_ledger');
        const q = query(
            auditRef,
            orderBy('timestamp', 'desc'),
            limit(maxResults)
        );

        // Fallback filter in memory if composite index is missing during dev
        const snapshot = await getDocs(q);

        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as LegalAuditRecord))
            .filter(record => record.targetId === targetId && record.targetType === targetType);
    }
}
