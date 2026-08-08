import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
    createUserWithEmailAndPassword: mocks.createUserWithEmailAndPassword,
    signOut: mocks.signOut,
    sendPasswordResetEmail: mocks.sendPasswordResetEmail,
  };
});

vi.mock('./firebase', () => ({
  auth: undefined,
  db: undefined,
}));

import { logOut, resetPassword, signInWithEmail, signUpWithEmail } from './auth';

describe('landing authentication fail-closed behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['sign in', () => signInWithEmail('artist@example.com', 'password')],
    ['sign up', () => signUpWithEmail('artist@example.com', 'password', 'Artist')],
    ['sign out', () => logOut()],
    ['reset password', () => resetPassword('artist@example.com')],
  ])('does not fabricate success for %s when Firebase is unavailable', async (_label, action) => {
    await expect(action()).rejects.toThrow('Firebase Auth not initialized');
  });

  it('never calls Firebase Auth operations when initialization failed', async () => {
    await Promise.allSettled([
      signInWithEmail('artist@example.com', 'password'),
      signUpWithEmail('artist@example.com', 'password', 'Artist'),
      logOut(),
      resetPassword('artist@example.com'),
    ]);

    expect(mocks.signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(mocks.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
