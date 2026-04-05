import type { OrgAdapter, CatalogTrack, SubmissionResult } from '../types';
import { logger } from '@/utils/logger';

export const SesacAdapter: OrgAdapter = {
  id: 'sesac',
  name: 'SESAC',
  shortName: 'SESAC',
  category: 'pro',
  requiresDesktop: true,
  websiteUrl: 'https://www.sesac.com',
  fee: { amount: 0, currency: 'USD', notes: 'Free for SESAC members (invite-only membership)' },

  fields: [
    {
      id: 'workTitle',
      label: 'Song title',
      orgLabel: 'Work Title',
      type: 'text',
      required: true,
      autoFillFrom: 'title',
    },
    {
      id: 'iswc',
      label: 'ISWC (if known)',
      orgLabel: 'ISWC',
      type: 'text',
      required: false,
      autoFillFrom: 'iswc',
    },
    {
      id: 'writers',
      label: 'All songwriters on this track',
      orgLabel: 'Writers / Contributors',
      type: 'textarea',
      required: true,
      autoFillFrom: 'writersAndContributors',
    },
  ],

  async submit(data, track: CatalogTrack, userId: string): Promise<SubmissionResult> {
    logger.info('[SesacAdapter] Initiating SESAC work registration via browser automation', { trackId: track.id });

    try {
      const { BrowserAgentService } = await import('@/services/agent/BrowserAgentService');
      const browserService = new BrowserAgentService();

      const task = `
        Navigate to the SESAC member portal at https://www.sesac.com and register the following work:
        - Title: ${data.workTitle}
        - Writers: ${JSON.stringify(track.writersAndContributors)}
        - ISWC: ${data.iswc || 'N/A'}

        If login is required, stop and report that SESAC credentials are needed.
        Return the work registration confirmation number.
      `;

      const result = await browserService.executeTask(task);
      await persistRecord(userId, track.id, 'sesac', data, result.confirmationNumber);

      return { success: true, confirmationNumber: result.confirmationNumber, submittedAt: new Date() };
    } catch (err: unknown) {
      const isWebSession = typeof window !== 'undefined' && !window.electronAPI;
      logger.warn('[SesacAdapter] Submission failed:', err);
      await persistRecord(userId, track.id, 'sesac', data, undefined);
      return {
        success: false,
        submittedAt: new Date(),
        requiresManualStep: true,
        manualStepUrl: 'https://www.sesac.com',
        manualStepInstructions: isWebSession
          ? 'SESAC registration requires the indiiOS desktop app or manual login at sesac.com.'
          : 'SESAC browser automation failed. Please complete registration manually at sesac.com.',
      };
    }
  },
};

async function persistRecord(
  userId: string, trackId: string, orgId: string,
  formSnapshot: Record<string, unknown>, confirmationNumber?: string
) {
  try {
    const { db } = await import('@/services/firebase');
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    await setDoc(
      doc(db, `registrations/${userId}/tracks/${trackId}/orgs/${orgId}`),
      { status: confirmationNumber ? 'submitted' : 'in_progress', submittedAt: serverTimestamp(), confirmationNumber: confirmationNumber ?? null, formSnapshot, lastUpdated: serverTimestamp() },
      { merge: true }
    );
  } catch (e) { logger.warn('[SesacAdapter] Failed to persist:', e); }
}
