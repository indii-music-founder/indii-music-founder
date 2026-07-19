import type { OrgAdapter, CatalogTrack, SubmissionResult } from '../types';
import { persistOrgRecord } from '../services/RegistrationPersistence';
import { logger } from '@/utils/logger';
import { getConfirmedAutomationResult } from './automationResult';

export const LocAdapter: OrgAdapter = {
  id: 'loc',
  name: 'U.S. Copyright Office',
  shortName: 'USCO',
  category: 'copyright',
  requiresDesktop: true,
  websiteUrl: 'https://www.copyright.gov/registration/',
  timeline: 'Processing time varies by claim and filing method',

  fields: [
    {
      id: 'claimScope',
      label: 'What are you registering?',
      orgLabel: 'Type of Work / Claim Scope',
      type: 'select',
      required: true,
      options: ['Sound recording only', 'Musical composition only', 'Both sound recording and musical composition'],
      helpText: 'A composition (music/lyrics) and a particular sound recording are separate works. A combined claim is only available when the ownership requirements for both works are satisfied.',
    },
    {
      id: 'workTitle',
      label: 'Song title',
      orgLabel: 'Title of Work',
      type: 'text',
      required: true,
      autoFillFrom: 'title',
      helpText: 'The title of the song exactly as it appears on the release.',
    },
    {
      id: 'yearOfCreation',
      label: 'Year you created this',
      orgLabel: 'Year of Creation',
      type: 'text',
      required: true,
      autoFillFrom: 'yearOfCreation',
      placeholder: 'e.g. 2024',
      helpText: 'The year you finished writing or recording this work.',
    },
    {
      id: 'authorName',
      label: 'Your legal name (as author)',
      orgLabel: 'Author / Claimant Name',
      type: 'text',
      required: true,
      autoFillFrom: 'artistName',
      helpText: 'Your full legal name as it will appear on the copyright certificate.',
    },
    {
      id: 'isPublished',
      label: 'Has this been publicly released?',
      orgLabel: 'Publication Status',
      type: 'boolean',
      required: true,
      autoFillFrom: 'isPublished',
      helpText: 'Published means it was released on streaming, sold, or distributed to the public.',
    },
    {
      id: 'countryOfFirstPublication',
      label: 'Country where it was first released',
      orgLabel: 'Nation of First Publication',
      type: 'text',
      required: false,
      autoFillFrom: 'countryOfFirstPublication',
      placeholder: 'e.g. United States',
    },
    {
      id: 'workForHire',
      label: 'Was this made as a work-for-hire?',
      orgLabel: 'Work Made for Hire',
      type: 'boolean',
      required: true,
      autoFillFrom: 'workForHire',
      helpText: 'Work-for-hire means you created it as an employee or under a specific contract that transferred ownership. Most independent artists answer No.',
    },
    {
      id: 'copyrightClaimant',
      label: 'Who owns the copyright?',
      orgLabel: 'Copyright Claimant',
      type: 'text',
      required: true,
      autoFillFrom: 'copyrightClaimant',
      helpText: 'Usually your legal name, or your publishing company name if you have one.',
    },
  ],

  async submit(data, track: CatalogTrack, userId: string): Promise<SubmissionResult> {
    logger.info('[LocAdapter] Initiating eCO copyright registration submission', { trackId: track.id, userId });

    // Desktop path: BrowserAgentService pilots eco.copyright.gov
    try {
      const { BrowserAgentService } = await import('@/services/agent/BrowserAgentService');
      const browserService = new BrowserAgentService();

      const result = await browserService.executeTask(
        'U.S. Copyright Office',
        `Register a copyright for the following work:
          - Claim Scope: ${data.claimScope}
          - Title: ${data.workTitle}
          - Year of Creation: ${data.yearOfCreation}
          - Author/Claimant: ${data.authorName}
          - Published: ${data.isPublished ? 'Yes' : 'No'}
          - Country of First Publication: ${data.countryOfFirstPublication || 'United States'}
          - Work for Hire: ${data.workForHire ? 'Yes' : 'No'}
          - Copyright Claimant: ${data.copyrightClaimant}
          Fill out the eCO registration form, submit it, and return the confirmation/case number.
          If login is required, stop and report back that credentials are needed.`,
        'https://www.copyright.gov/registration/'
      );

      const confirmationNumber = getConfirmedAutomationResult(result, 'U.S. Copyright Office');
      const persisted = await persistOrgRecord(userId, track.id, 'loc', data, confirmationNumber);

      return {
        success: true,
        confirmationNumber,
        submittedAt: new Date(),
        localRecordFailed: !persisted,
      };
    } catch (err: unknown) {
      const isWebSession = typeof window !== 'undefined' && !window.electronAPI;
      const persisted = await persistOrgRecord(userId, track.id, 'loc', data, undefined);

      if (isWebSession) {
        logger.info('[LocAdapter] Web session — returning manual fallback for Copyright Office submission');
        return {
          success: false,
          errorMessage: persisted ? undefined : 'The prepared filing could not be saved locally.',
          submittedAt: new Date(),
          requiresManualStep: true,
          manualStepUrl: 'https://www.copyright.gov/registration/',
          manualStepInstructions:
            'Automatic submission requires the indii desktop app. Your prepared registration details are saved; complete the application, fee, and required deposit through the U.S. Copyright Office portal.',
        };
      }

      logger.error('[LocAdapter] BrowserAgentService submission failed:', err);
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Submission failed',
        submittedAt: new Date(),
        requiresManualStep: true,
        manualStepUrl: 'https://www.copyright.gov/registration/',
        manualStepInstructions: 'Your prepared registration details are saved. Complete the application, fee, and required deposit through the U.S. Copyright Office portal.',
      };
    }
  },
};
