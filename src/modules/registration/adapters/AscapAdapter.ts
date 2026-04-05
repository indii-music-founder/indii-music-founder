import type { OrgAdapter, CatalogTrack, SubmissionResult } from '../types';
import { logger } from '@/utils/logger';

export const AscapAdapter: OrgAdapter = {
  id: 'ascap',
  name: 'ASCAP',
  shortName: 'ASCAP',
  category: 'pro',
  requiresDesktop: false,
  websiteUrl: 'https://www.ascap.com',
  fee: { amount: 0, currency: 'USD', notes: 'Free to register works once you are an ASCAP member' },

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
      label: 'ISWC (if you have one)',
      orgLabel: 'ISWC',
      type: 'text',
      required: false,
      autoFillFrom: 'iswc',
      helpText: 'International Standard Musical Work Code. If you registered with a publisher, you may already have one.',
      placeholder: 'T-000000000-0',
    },
    {
      id: 'ipiNumber',
      label: 'Your ASCAP member ID (IPI)',
      orgLabel: 'IPI Number',
      type: 'text',
      required: true,
      helpText: 'Your 9-digit IPI number from your ASCAP member account.',
      placeholder: '000000000',
    },
    {
      id: 'writers',
      label: 'All songwriters on this track',
      orgLabel: 'Writers / Contributors',
      type: 'textarea',
      required: true,
      autoFillFrom: 'writersAndContributors',
      helpText: 'List each writer with their name, role, and ownership percentage. If co-writers are ASCAP members, include their IPI numbers.',
    },
    {
      id: 'genre',
      label: 'Genre',
      orgLabel: 'Genre',
      type: 'select',
      required: false,
      autoFillFrom: 'genre',
      options: ['Pop', 'Hip-Hop/Rap', 'R&B/Soul', 'Rock', 'Country', 'Electronic/Dance', 'Jazz', 'Classical', 'Latin', 'Gospel/Christian', 'Folk', 'Other'],
    },
  ],

  async submit(data, track: CatalogTrack, userId: string): Promise<SubmissionResult> {
    logger.info('[AscapAdapter] Submitting work registration to ASCAP', { trackId: track.id });

    try {
      // Wrap existing PRORightsService for ASCAP API call
      const { PRORightsService } = await import('@/services/rights/PRORightsService');
      const service = new PRORightsService();

      const writers = track.writersAndContributors.map(w => ({
        name: w.name,
        role: w.role,
        percentage: w.percentage,
        ipiNumber: w.ipiNumber,
      }));

      const result = await service.registerWithASCAP({
        title: String(data.workTitle),
        iswc: data.iswc ? String(data.iswc) : undefined,
        writers,
        genre: data.genre ? String(data.genre) : undefined,
        isrc: track.isrc,
      });

      await persistRecord(userId, track.id, 'ascap', data, result.confirmationId);

      return {
        success: true,
        confirmationNumber: result.confirmationId,
        submittedAt: new Date(),
      };
    } catch (err: unknown) {
      logger.error('[AscapAdapter] Registration failed:', err);
      await persistRecord(userId, track.id, 'ascap', data, undefined);
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'ASCAP API submission failed',
        submittedAt: new Date(),
        requiresManualStep: true,
        manualStepUrl: 'https://www.ascap.com/myascap',
        manualStepInstructions: 'Log in to ASCAP Works and register this title manually. Your form data is saved below.',
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
  } catch (e) { logger.warn('[AscapAdapter] Failed to persist:', e); }
}
