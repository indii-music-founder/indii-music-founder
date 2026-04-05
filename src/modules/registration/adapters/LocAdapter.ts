import type { OrgAdapter, CatalogTrack, SubmissionResult } from '../types';
import { logger } from '@/utils/logger';

export const LocAdapter: OrgAdapter = {
  id: 'loc',
  name: 'Library of Congress',
  shortName: 'LoC',
  category: 'copyright',
  requiresDesktop: true,
  websiteUrl: 'https://eco.copyright.gov',
  fee: { amount: 45, currency: 'USD', notes: '$45 single work / $65 group of unpublished works' },
  timeline: '3–9 months',

  fields: [
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

      const task = `
        Navigate to https://eco.copyright.gov and register a copyright for the following work:
        - Title: ${data.workTitle}
        - Year of Creation: ${data.yearOfCreation}
        - Author/Claimant: ${data.authorName}
        - Published: ${data.isPublished ? 'Yes' : 'No'}
        - Country of First Publication: ${data.countryOfFirstPublication || 'United States'}
        - Work for Hire: ${data.workForHire ? 'Yes' : 'No'}
        - Copyright Claimant: ${data.copyrightClaimant}

        Fill out the eCO registration form, submit it, and return the confirmation/case number.
        If login is required, stop and report back that credentials are needed.
      `;

      const result = await browserService.executeTask(task);

      // Persist record to Firestore
      await persistRecord(userId, track.id, 'loc', data, result.confirmationNumber);

      return {
        success: true,
        confirmationNumber: result.confirmationNumber,
        submittedAt: new Date(),
      };
    } catch (err: unknown) {
      const isWebSession = typeof window !== 'undefined' && !window.electronAPI;

      if (isWebSession) {
        logger.info('[LocAdapter] Web session — returning manual fallback for LoC submission');
        return {
          success: false,
          submittedAt: new Date(),
          requiresManualStep: true,
          manualStepUrl: 'https://eco.copyright.gov',
          manualStepInstructions:
            'Automatic submission requires the indiiOS desktop app. Your pre-filled registration details are ready below — you can download them and complete submission on eco.copyright.gov.',
        };
      }

      logger.error('[LocAdapter] BrowserAgentService submission failed:', err);
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Submission failed',
        submittedAt: new Date(),
      };
    }
  },
};

async function persistRecord(
  userId: string,
  trackId: string,
  orgId: string,
  formSnapshot: Record<string, unknown>,
  confirmationNumber?: string
) {
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
    logger.warn('[LocAdapter] Failed to persist registration record:', e);
  }
}
