import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@/services/business-harness';
import { RegistrationForm } from './RegistrationForm';
import { ORG_ADAPTERS } from '../adapters';
import type { CatalogTrack, OrgId } from '../types';

vi.mock('../services/RegistrationPersistence', () => ({
  persistOrgRecord: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/PassportHashService', () => ({
  computePassportHash: vi.fn().mockResolvedValue('passport_hash_mock_123'),
  validateApprovalFreshness: vi.fn().mockResolvedValue({ isFresh: true }),
}));

describe('RegistrationForm Pause Gates & 6 Org Submissions', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockTrack: CatalogTrack = {
    id: 'track-water-way',
    title: 'Water Finds a Way',
    artistName: 'indii',
    writersAndContributors: [
      {
        name: 'Writer One',
        role: 'composer',
        percentage: 50,
        ipiNumber: '00123456789',
      },
      {
        name: 'Writer Two',
        role: 'lyricist',
        percentage: 50,
        ipiNumber: '00987654321',
      },
    ],
    isrc: 'USABC2600001',
    isPublished: false,
    publisherName: 'Indii Publishing',
  };

  const orgIds: OrgId[] = ['loc', 'ascap', 'bmi', 'sesac', 'soundexchange', 'mlc'];

  for (const orgId of orgIds) {
    it(`completes Pause Gate 1 -> Pause Gate 2 -> submission for ${orgId.toUpperCase()}`, async () => {
      const adapter = ORG_ADAPTERS[orgId];
      const submitSpy = vi.spyOn(adapter, 'submit').mockResolvedValue({
        success: true,
        confirmationNumber: `CONF-${orgId.toUpperCase()}-1234`,
        submittedAt: new Date(),
      });
      const onSubmitComplete = vi.fn();

      render(
        <RegistrationForm
          adapter={adapter}
          track={mockTrack}
          userId="user-test-123"
          onSubmitComplete={onSubmitComplete}
        />
      );

      // Initial submit click to trigger Pause Gate 1
      const submitButtons = screen.getAllByRole('button');
      const proceedButton = submitButtons.find(b => b.textContent?.includes('Proceed with filing') || b.textContent?.includes('Submit') || b.getAttribute('type') === 'submit');
      expect(proceedButton).toBeDefined();
      fireEvent.click(proceedButton!);

      // Pause Gate 1: Certification Review
      expect(await screen.findByText('Certification Review')).toBeDefined();
      const reviewButton = screen.getByRole('button', { name: "I've reviewed — proceed to filing" });
      fireEvent.click(reviewButton);

      // Pause Gate 2: Final Submission Confirmation
      expect(await screen.findByText('Final Submission Confirmation')).toBeDefined();
      const confirmButton = screen.getByRole('button', { name: `Confirm & submit to ${adapter.name}` });
      fireEvent.click(confirmButton);

      // Final Submission complete
      await waitFor(() => {
        expect(submitSpy).toHaveBeenCalled();
        expect(onSubmitComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            confirmationNumber: `CONF-${orgId.toUpperCase()}-1234`,
          })
        );
      });

      submitSpy.mockRestore();
    });
  }
});
