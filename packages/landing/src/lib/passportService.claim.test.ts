import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(() => ({ path: 'prospect_assessments/assessment-1' })),
}));

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  updateDoc: mocks.updateDoc,
  serverTimestamp: () => 'server-time',
}));

import { claimProspectAssessment, updateAssessmentContact } from './passportService';

describe('claimProspectAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not claim an assessment that is missing or owned by another account', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(claimProspectAssessment('assessment-1', 'artist-a'))
      .rejects.toThrow('could not be found');

    mocks.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ claimedByUid: 'artist-b' }) });
    await expect(claimProspectAssessment('assessment-1', 'artist-a'))
      .rejects.toThrow('another account');
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });

  it('treats a repeat claim by the same account as already complete', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ claimedByUid: 'artist-a' }) });
    await expect(claimProspectAssessment('assessment-1', 'artist-a')).resolves.toBeUndefined();
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });

  it('surfaces a failed write so the same account can retry', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ claimedByUid: null }) });
    mocks.updateDoc.mockRejectedValueOnce(new Error('temporarily unavailable')).mockResolvedValueOnce(undefined);

    await expect(claimProspectAssessment('assessment-1', 'artist-a'))
      .rejects.toThrow('temporarily unavailable');
    await expect(claimProspectAssessment('assessment-1', 'artist-a')).resolves.toBeUndefined();
    expect(mocks.updateDoc).toHaveBeenCalledTimes(2);
    expect(mocks.updateDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'prospect_assessments/assessment-1' }),
      expect.objectContaining({ claimedByUid: 'artist-a' }),
    );
  });

  it('enforces email match when assessment has a bound email', async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ claimedByUid: null, email: 'alice@example.com' }),
    });

    // Mismatched caller email is rejected
    await expect(claimProspectAssessment('assessment-1', 'artist-eve', 'eve@example.com'))
      .rejects.toThrow('different email address');
    expect(mocks.updateDoc).not.toHaveBeenCalled();

    // Matching caller email succeeds
    await expect(claimProspectAssessment('assessment-1', 'artist-alice', 'alice@example.com'))
      .resolves.toBeUndefined();
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'prospect_assessments/assessment-1' }),
      expect.objectContaining({ claimedByUid: 'artist-alice' }),
    );
  });
});

describe('updateAssessmentContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects modifying contact email once set on the assessment', async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ claimedByUid: null, email: 'original@example.com' }),
    });

    await expect(updateAssessmentContact('assessment-1', { email: 'hijacked@example.com' }))
      .rejects.toThrow('cannot be modified once set');
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });

  it('allows updating contact when email is unchanged or added initially', async () => {
    mocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ claimedByUid: null, email: 'original@example.com' }),
    });

    await expect(updateAssessmentContact('assessment-1', {
      email: 'original@example.com',
      marketingConsent: true,
      assessmentConsent: true,
    })).resolves.toBeUndefined();
    expect(mocks.updateDoc).toHaveBeenCalled();
  });
});
