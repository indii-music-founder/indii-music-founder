import type { OrgId } from '../types';
import { logger } from '@/utils/logger';

/**
 * Writes a registration attempt record to Firestore.
 * Shared by all org adapters — do not duplicate per-adapter.
 *
 * ISSUE-970 fix: returns whether the write actually succeeded instead of
 * silently swallowing the failure. A `false` return with a confirmation
 * number present means the EXTERNAL registration succeeded but our own
 * durable record did not — callers must surface that as a distinct state
 * (`localRecordFailed`), never as plain success (loses the confirmation)
 * or plain failure (implies the filing itself didn't go through).
 */
export async function persistOrgRecord(
  userId: string,
  trackId: string,
  orgId: OrgId,
  formSnapshot: Record<string, unknown>,
  confirmationNumber?: string
): Promise<boolean> {
  try {
    const { db } = await import('@/services/firebase');
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    await setDoc(
      doc(db, `registrations/${userId}/tracks/${trackId}/orgs/${orgId}`),
      {
        status: confirmationNumber ? 'submitted' : 'in_progress',
        submittedAt: serverTimestamp(),
        confirmationNumber: confirmationNumber ?? null,
        formSnapshot,
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (e) {
    logger.warn(`[RegistrationPersistence] Failed to persist ${orgId} record for track ${trackId}:`, e);
    return false;
  }
}
