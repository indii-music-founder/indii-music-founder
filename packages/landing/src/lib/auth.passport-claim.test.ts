import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  sendEmailVerification: vi.fn(),
  claimProspectAssessment: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('./firebase', () => ({ auth: {}, db: {} }));
vi.mock('./passportService', () => ({ claimProspectAssessment: mocks.claimProspectAssessment }));
vi.mock('firebase/auth', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase/auth')>(),
  createUserWithEmailAndPassword: mocks.createUserWithEmailAndPassword,
  updateProfile: mocks.updateProfile,
  sendEmailVerification: mocks.sendEmailVerification,
}));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  doc: () => ({ path: 'users/artist-a' }),
  setDoc: mocks.setDoc,
  serverTimestamp: () => 'server-time',
}));

import { signUpWithEmail } from './auth';

describe('signUpWithEmail Passport linking outcome', () => {
  const user = {
    uid: 'artist-a',
    email: 'artist@example.com',
    displayName: null,
    photoURL: null,
    getIdToken: vi.fn().mockResolvedValue('token'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createUserWithEmailAndPassword.mockResolvedValue({ user });
    mocks.updateProfile.mockResolvedValue(undefined);
    mocks.setDoc.mockResolvedValue(undefined);
    mocks.sendEmailVerification.mockResolvedValue(undefined);
  });

  it('keeps the created account and sends verification when Passport linking fails', async () => {
    mocks.claimProspectAssessment.mockRejectedValue(new Error('temporarily unavailable'));

    const result = await signUpWithEmail('artist@example.com', 'password', 'Artist', undefined, 'assessment-1');

    expect(result).toEqual({ user, passportClaimFailed: true });
    expect(mocks.sendEmailVerification).toHaveBeenCalledWith(user);
    expect(mocks.claimProspectAssessment).toHaveBeenCalledWith('assessment-1', 'artist-a', 'artist@example.com');
  });

  it('reports successful Passport linking separately from account creation', async () => {
    mocks.claimProspectAssessment.mockResolvedValue(undefined);

    const result = await signUpWithEmail('artist@example.com', 'password', 'Artist', undefined, 'assessment-1');

    expect(result).toEqual({ user, passportClaimFailed: false });
    expect(mocks.sendEmailVerification).toHaveBeenCalledWith(user);
  });
});
