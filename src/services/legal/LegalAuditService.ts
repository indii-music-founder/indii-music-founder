import { db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { logger } from '@/utils/logger';

// Item 258: SHA-256 hash using Web Crypto API (Node 22 / browser compatible)
async function sha256(data: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
    // Item 258: Tamper-evident hash chain
    prevHash?: string;      // SHA-256 of previous entry (forms a linked chain)
    entryHash?: string;     // SHA-256 of this entry's canonical fields
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

            // Item 258: Get the hash of the most recent entry to form the chain
            const lastEntryQuery = query(auditRef, orderBy('timestamp', 'desc'), limit(1));
            const lastSnapshot = await getDocs(lastEntryQuery);
            const prevHash = lastSnapshot.empty
                ? '0'.repeat(64)  // Genesis hash (no previous entry)
                : (lastSnapshot.docs[0]!.data() as LegalAuditRecord).entryHash || '0'.repeat(64);

            // Compute this entry's canonical hash (deterministic fields only — not timestamp)
            const canonicalData = JSON.stringify({ actionType, actorUid, targetId, targetType, prevHash });
            const entryHash = await sha256(canonicalData);

            const docRef = await addDoc(auditRef, {
                actionType,
                actorUid,
                targetId,
                targetType,
                metadata,
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
                timestamp: serverTimestamp(),
                prevHash,
                entryHash,
            });

            logger.info(`[LegalAudit] Recorded event: ${actionType} on ${targetType} ${targetId}`);
            return docRef.id;
        } catch (error: unknown) {
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
