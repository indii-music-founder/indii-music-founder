import type { OrgAdapter, CatalogTrack, SubmissionResult } from '../types';
import { persistOrgRecord } from '../services/RegistrationPersistence';
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

      const result = await browserService.executeTask(
        'SESAC',
        `Register the following work:
          - Title: ${data.workTitle}
          - Writers: ${JSON.stringify(track.writersAndContributors)}
          - ISWC: ${data.iswc || 'N/A'}
          If login is required, stop and report that SESAC credentials are needed.
          Return the work registration confirmation number.`,
        'https://www.sesac.com'
      );
      const confirmationNumber = result.result ?? result.id;
      await persistOrgRecord(userId, track.id, 'sesac', data, confirmationNumber);

      return { success: true, confirmationNumber, submittedAt: new Date() };
    } catch (err: unknown) {
      const isWebSession = typeof window !== 'undefined' && !window.electronAPI;
      logger.warn('[SesacAdapter] Submission failed:', err);
      await persistOrgRecord(userId, track.id, 'sesac', data, undefined);
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
