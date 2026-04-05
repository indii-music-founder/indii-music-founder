import type { OrgAdapter, CatalogTrack, SubmissionResult } from '../types';
import { persistOrgRecord } from '../services/RegistrationPersistence';
import { logger } from '@/utils/logger';

export const BmiAdapter: OrgAdapter = {
  id: 'bmi',
  name: 'BMI',
  shortName: 'BMI',
  category: 'pro',
  requiresDesktop: false,
  websiteUrl: 'https://worksexpress.bmi.com',
  fee: { amount: 0, currency: 'USD', notes: 'Free for BMI members' },

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
      placeholder: 'T-000000000-0',
    },
    {
      id: 'publisherNumber',
      label: 'BMI Publisher Account number (if you have a publishing entity)',
      orgLabel: 'Publisher Number',
      type: 'text',
      required: false,
      autoFillFrom: 'publisherNumber',
      helpText: 'Only needed if you registered a publishing company with BMI. Leave blank if you are self-published.',
    },
    {
      id: 'writers',
      label: 'All songwriters on this track',
      orgLabel: 'Writers / Contributors',
      type: 'textarea',
      required: true,
      autoFillFrom: 'writersAndContributors',
      helpText: 'List name, role (composer/lyricist), and ownership percentage for each writer.',
    },
  ],

  async submit(data, track: CatalogTrack, userId: string): Promise<SubmissionResult> {
    logger.info('[BmiAdapter] Submitting work registration to BMI Works Express', { trackId: track.id });

    try {
      const { registerWithBMI } = await import('@/services/rights/PRORightsService');

      const metadata = {
        trackTitle: String(data.workTitle),
        iswc: data.iswc ? String(data.iswc) : undefined,
        isrc: track.isrc,
        composerName: track.writersAndContributors[0]?.name ?? String(data.writers),
        artistName: track.artistName,
        publisherShare: data.publisherNumber ? 50 : undefined,
      };

      const result = await registerWithBMI(userId, metadata as Parameters<typeof registerWithBMI>[1]);

      await persistOrgRecord(userId, track.id, 'bmi', data, result.workId);

      return {
        success: true,
        confirmationNumber: result.workId,
        submittedAt: new Date(),
      };
    } catch (err: unknown) {
      logger.error('[BmiAdapter] Registration failed:', err);
      await persistOrgRecord(userId, track.id, 'bmi', data, undefined);
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'BMI Works Express submission failed',
        submittedAt: new Date(),
        requiresManualStep: true,
        manualStepUrl: 'https://worksexpress.bmi.com',
        manualStepInstructions: 'Log in to BMI Works Express and register this title manually.',
      };
    }
  },
};
