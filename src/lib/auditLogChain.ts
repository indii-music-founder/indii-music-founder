import { doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { logger } from '@/utils/logger';

/**
 * Item 258: Tamper-Evident Audit Log Hash Chain
 *
 * Each audit log entry includes a SHA-256 hash of the previous entry,
 * creating a tamper-evident chain. If any entry is silently deleted or
 * modified, the chain will break and verification will fail.
 *
 * Storage: users/{uid}/auditLogs/{entryId}
 */

export interface AuditLogEntry {
    id: string;
    userId: string;
    action: string;
    details: Record<string, unknown>;
    timestamp: ReturnType<typeof serverTimestamp>;
    prevHash: string;       // SHA-256 hash of previous entry's data
    entryHash: string;      // SHA-256 hash of this entry's data (for next entry)
    sequenceNumber: number;
}

/**
 * Compute SHA-256 hash of an arbitrary string using the Web Crypto API.
 */
async function sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build the hashable payload from an audit entry's core data.
 * Deterministic: same input always produces the same string.
 */
function buildHashablePayload(
    action: string,
    details: Record<string, unknown>,
    sequenceNumber: number,
    prevHash: string
): string {
    return JSON.stringify({
        action,
        details,
        sequenceNumber,
        prevHash,
    });
}

/**
 * Fetch the latest audit log entry for a user.
 * Returns null if no entries exist (genesis case).
 */
async function getLatestEntry(userId: string): Promise<{ prevHash: string; sequenceNumber: number } | null> {
    try {
        const logsRef = collection(db, 'users', userId, 'auditLogs');
        const q = query(logsRef, orderBy('sequenceNumber', 'desc'), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const latestDoc = snapshot.docs[0].data();
        return {
            prevHash: latestDoc.entryHash as string,
            sequenceNumber: latestDoc.sequenceNumber as number,
        };
    } catch (error) {
        logger.error('[AuditLog] Failed to fetch latest entry', error);
        return null;
    }
}

/**
 * Write a new tamper-evident audit log entry.
 *
 * @param userId - The user whose audit log this belongs to
 * @param action - Action identifier (e.g., 'release.created', 'account.deleted', 'split.signed')
 * @param details - Arbitrary metadata about the action
 */
export async function writeAuditLog(
    userId: string,
    action: string,
    details: Record<string, unknown> = {}
): Promise<string> {
    // Get the previous entry's hash (or genesis hash)
    const latest = await getLatestEntry(userId);
    const prevHash = latest?.prevHash ?? '0'.repeat(64); // Genesis hash: 64 zeros
    const sequenceNumber = (latest?.sequenceNumber ?? 0) + 1;

    // Build deterministic payload and hash it
    const payload = buildHashablePayload(action, details, sequenceNumber, prevHash);
    const entryHash = await sha256(payload);

    // Generate entry ID
    const entryId = `audit_${Date.now()}_${sequenceNumber}`;

    // Write to Firestore
    const entryRef = doc(db, 'users', userId, 'auditLogs', entryId);
    await setDoc(entryRef, {
        id: entryId,
        userId,
        action,
        details,
        timestamp: serverTimestamp(),
        prevHash,
        entryHash,
        sequenceNumber,
    });

    logger.info(`[AuditLog] Entry #${sequenceNumber} written: ${action} (hash: ${entryHash.substring(0, 12)}...)`);

    return entryId;
}

/**
 * Verify the integrity of a user's audit log chain.
 * Returns true if the chain is intact, false if tampering is detected.
 *
 * @param userId - The user whose audit log to verify
 * @param maxEntries - Maximum number of entries to check (default: 100)
 */
export async function verifyAuditChain(userId: string, maxEntries = 100): Promise<{
    valid: boolean;
    entriesChecked: number;
    brokenAt?: number;
    error?: string;
}> {
    try {
        const logsRef = collection(db, 'users', userId, 'auditLogs');
        const q = query(logsRef, orderBy('sequenceNumber', 'asc'), limit(maxEntries));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { valid: true, entriesChecked: 0 };
        }

        let expectedPrevHash = '0'.repeat(64); // Genesis

        for (const docSnap of snapshot.docs) {
            const entry = docSnap.data();

            // Verify the prevHash matches what we expect
            if (entry.prevHash !== expectedPrevHash) {
                logger.error(`[AuditLog] Chain broken at sequence #${entry.sequenceNumber}. Expected prevHash: ${expectedPrevHash.substring(0, 12)}..., got: ${entry.prevHash?.substring(0, 12)}...`);
                return {
                    valid: false,
                    entriesChecked: entry.sequenceNumber,
                    brokenAt: entry.sequenceNumber,
                    error: `prevHash mismatch at entry #${entry.sequenceNumber}`,
                };
            }

            // Recompute the entry's hash to verify it wasn't modified
            const payload = buildHashablePayload(
                entry.action,
                entry.details,
                entry.sequenceNumber,
                entry.prevHash
            );
            const recomputedHash = await sha256(payload);

            if (recomputedHash !== entry.entryHash) {
                logger.error(`[AuditLog] Entry #${entry.sequenceNumber} has been tampered with. Expected hash: ${recomputedHash.substring(0, 12)}..., stored: ${entry.entryHash?.substring(0, 12)}...`);
                return {
                    valid: false,
                    entriesChecked: entry.sequenceNumber,
                    brokenAt: entry.sequenceNumber,
                    error: `entryHash mismatch at entry #${entry.sequenceNumber} (data tampered)`,
                };
            }

            // Forward the chain
            expectedPrevHash = entry.entryHash;
        }

        return { valid: true, entriesChecked: snapshot.size };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[AuditLog] Chain verification failed', error);
        return { valid: false, entriesChecked: 0, error: message };
    }
}
