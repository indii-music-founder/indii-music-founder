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

    const persisted = await persistOrgRecord(userId, track.id, 'sesac', data, undefined);
    logger.info('[SesacAdapter] Prepared filing saved for manual completion', { trackId: track.id, saved: persisted });
    return {
      success: false,
      errorMessage: persisted ? undefined : 'The prepared filing could not be saved locally.',
      submittedAt: new Date(),
      requiresManualStep: true,
      manualStepUrl: 'https://www.sesac.com',
      manualStepInstructions: 'Your filing details are prepared, but no information was entered or submitted on your behalf. Review them and complete registration through SESAC membership services.',
    };
  },
};
