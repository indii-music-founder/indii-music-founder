import type { OrgAdapter, CatalogTrack, SubmissionResult } from '../types';
import { persistOrgRecord } from '../services/RegistrationPersistence';
import { logger } from '@/utils/logger';

export const SoundExchangeAdapter: OrgAdapter = {
  id: 'soundexchange',
  name: 'SoundExchange',
  shortName: 'SX',
  category: 'digital',
  requiresDesktop: false,
  websiteUrl: 'https://www.soundexchange.com',
  fee: { amount: 0, currency: 'USD', notes: 'Free to enroll' },

  fields: [
    {
      id: 'isrc',
      label: 'ISRC code for this recording',
      orgLabel: 'ISRC',
      type: 'text',
      required: true,
      autoFillFrom: 'isrc',
      helpText: 'International Standard Recording Code. Your distributor assigned this when you released the track. Check your DistroKid/TuneCore/CD Baby dashboard.',
      placeholder: 'US-XXX-XX-XXXXX',
    },
    {
      id: 'performerName',
      label: 'Artist / performer name',
      orgLabel: 'Performer Name',
      type: 'text',
      required: true,
      autoFillFrom: 'artistName',
    },
    {
      id: 'recordingTitle',
      label: 'Song title (as released)',
      orgLabel: 'Sound Recording Title',
      type: 'text',
      required: true,
      autoFillFrom: 'title',
    },
    {
      id: 'ownershipPercentage',
      label: 'Your ownership percentage of this sound recording',
      orgLabel: 'Sound Recording Copyright Ownership %',
      type: 'text',
      required: true,
      placeholder: '100',
      helpText: 'Usually 100% unless you co-own the master recording with another party.',
    },
  ],

  async submit(data, track: CatalogTrack, userId: string): Promise<SubmissionResult> {
    logger.info('[SoundExchangeAdapter] Enrolling ISRC with SoundExchange', { trackId: track.id, isrc: data.isrc });

    try {
      const { PRORightsService } = await import('@/services/rights/PRORightsService');
      const service = new PRORightsService();

      const result = await service.enrollWithSoundExchange({
        isrc: String(data.isrc),
        performerName: String(data.performerName),
        recordingTitle: String(data.recordingTitle),
        ownershipPercentage: Number(data.ownershipPercentage) || 100,
      });

      await persistOrgRecord(userId, track.id, 'soundexchange', data, result.confirmationId);

      return { success: true, confirmationNumber: result.confirmationId, submittedAt: new Date() };
    } catch (err: unknown) {
      logger.error('[SoundExchangeAdapter] Enrollment failed:', err);
      await persistOrgRecord(userId, track.id, 'soundexchange', data, undefined);
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'SoundExchange enrollment failed',
        submittedAt: new Date(),
        requiresManualStep: true,
        manualStepUrl: 'https://www.soundexchange.com/member-login',
        manualStepInstructions: 'Log in to SoundExchange and enroll your ISRC manually.',
      };
    }
  },
};
