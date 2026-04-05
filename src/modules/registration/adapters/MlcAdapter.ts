import type { OrgAdapter, CatalogTrack, SubmissionResult } from '../types';
import { persistOrgRecord } from '../services/RegistrationPersistence';
import { logger } from '@/utils/logger';

export const MlcAdapter: OrgAdapter = {
  id: 'mlc',
  name: 'The Mechanical Licensing Collective',
  shortName: 'MLC',
  category: 'mechanical',
  requiresDesktop: true,
  websiteUrl: 'https://www.themlc.com',
  fee: { amount: 0, currency: 'USD', notes: 'Free to register works' },

  fields: [
    {
      id: 'workTitle',
      label: 'Song title',
      orgLabel: 'Musical Work Title',
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
      helpText: 'International Standard Musical Work Code. Having this speeds up the MLC matching process.',
    },
    {
      id: 'ipiNumber',
      label: 'Your IPI number (from your PRO)',
      orgLabel: 'IPI Number',
      type: 'text',
      required: true,
      helpText: 'The IPI number linked to your ASCAP, BMI, or SESAC account.',
    },
    {
      id: 'writers',
      label: 'All songwriters and their ownership percentages',
      orgLabel: 'Writers / Contributors',
      type: 'textarea',
      required: true,
      autoFillFrom: 'writersAndContributors',
      helpText: 'The MLC needs 100% of shares accounted for. Include all co-writers.',
    },
  ],

  async submit(data, track: CatalogTrack, userId: string): Promise<SubmissionResult> {
    logger.info('[MlcAdapter] Initiating MLC work registration via browser automation', { trackId: track.id });

    try {
      const { BrowserAgentService } = await import('@/services/agent/BrowserAgentService');
      const browserService = new BrowserAgentService();

      const task = `
        Navigate to the MLC member portal at https://portal.themlc.com and register the following musical work:
        - Title: ${data.workTitle}
        - ISWC: ${data.iswc || 'N/A'}
        - IPI: ${data.ipiNumber}
        - Writers: ${JSON.stringify(track.writersAndContributors)}

        Log in if necessary (stop and report if credentials are needed).
        Complete the work registration form and return the MLC work registration ID.
      `;

      const result = await browserService.executeTask(task);
      await persistOrgRecord(userId, track.id, 'mlc', data, result.confirmationNumber);

      return { success: true, confirmationNumber: result.confirmationNumber, submittedAt: new Date() };
    } catch (err: unknown) {
      const isWebSession = typeof window !== 'undefined' && !window.electronAPI;
      logger.warn('[MlcAdapter] Submission failed:', err);
      await persistOrgRecord(userId, track.id, 'mlc', data, undefined);
      return {
        success: false,
        submittedAt: new Date(),
        requiresManualStep: true,
        manualStepUrl: 'https://portal.themlc.com',
        manualStepInstructions: isWebSession
          ? 'MLC registration requires the indiiOS desktop app or manual login at themlc.com.'
          : 'MLC browser automation failed. Please complete registration manually at themlc.com.',
      };
    }
  },
};
