import type { OrgId } from '../types';
import { logger } from '@/utils/logger';

/**
 * Writes a registration attempt record to Firestore.
 * Shared by all org adapters — do not duplicate per-adapter.
 */
export async function persistOrgRecord(
  userId: string,
  trackId: string,
  orgId: OrgId,
  formSnapshot: Record<string, unknown>,
  confirmationNumber?: string
): Promise<void> {
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
  } catch (e) {
    logger.warn(`[RegistrationPersistence] Failed to persist ${orgId} record for track ${trackId}:`, e);
  }
}
