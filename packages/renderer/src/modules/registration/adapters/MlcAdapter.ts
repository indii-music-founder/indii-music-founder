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

    const persisted = await persistOrgRecord(userId, track.id, 'mlc', data, undefined);
    logger.info('[MlcAdapter] Prepared filing saved for manual completion', { trackId: track.id, saved: persisted });
    return {
      success: false,
      errorMessage: persisted ? undefined : 'The prepared filing could not be saved locally.',
      submittedAt: new Date(),
      requiresManualStep: true,
      manualStepUrl: 'https://portal.themlc.com',
      manualStepInstructions: 'Your filing details are prepared, but no information was entered or submitted on your behalf. Review the details and complete registration at the MLC portal.',
    };
  },
};
