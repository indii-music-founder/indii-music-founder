import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as null | {
    email: string | null;
    emailVerified: boolean;
    getIdToken: ReturnType<typeof vi.fn>;
  } },
  functions: { region: 'us-central1' },
  sendSignInLinkToEmail: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  signInWithEmailLink: vi.fn(),
  callable: vi.fn(),
  httpsCallable: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  sendSignInLinkToEmail: mocks.sendSignInLinkToEmail,
  isSignInWithEmailLink: mocks.isSignInWithEmailLink,
  signInWithEmailLink: mocks.signInWithEmailLink,
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: mocks.httpsCallable,
}));

vi.mock('./firebase', () => ({
  auth: mocks.auth,
  functions: mocks.functions,
}));

import {
  beginFoundingArtistVerification,
  completeFoundingArtistVerification,
  enrollCurrentVerifiedArtist,
} from './foundingArtistWaitlist';

describe('Founding Artist waitlist verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.auth.currentUser = null;
    mocks.isSignInWithEmailLink.mockReturnValue(false);
    mocks.callable.mockResolvedValue({
      data: { status: 'waitlisted', queuePosition: 12, alreadyJoined: false },
    });
    mocks.httpsCallable.mockReturnValue(mocks.callable);
    window.history.replaceState({}, '', '/');
  });

  it('normalizes the address and sends a same-origin email sign-in link', async () => {
    await beginFoundingArtistVerification('  Artist@Example.COM ', false);

    expect(mocks.sendSignInLinkToEmail).toHaveBeenCalledWith(
      mocks.auth,
      'artist@example.com',
      {
        url: `${window.location.origin}/?completeWaitlist=true#waitlist`,
        handleCodeInApp: true,
      },
    );
    expect(localStorage.getItem('indii_founding_artist_email')).toBe('artist@example.com');
    expect(localStorage.getItem('indii_founding_artist_milestones')).toBe('false');
  });

  it('preserves preference-management mode through email verification', async () => {
    window.history.replaceState({}, '', '/?manageUpdates=true#waitlist');

    await beginFoundingArtistVerification('artist@example.com', false);

    expect(mocks.sendSignInLinkToEmail).toHaveBeenCalledWith(
      mocks.auth,
      'artist@example.com',
      {
        url: `${window.location.origin}/?completeWaitlist=true&manageUpdates=true#waitlist`,
        handleCodeInApp: true,
      },
    );
  });

  it('exchanges a valid link before calling the server enrollment function', async () => {
    const getIdToken = vi.fn().mockResolvedValue('fresh-token');
    mocks.isSignInWithEmailLink.mockReturnValue(true);
    mocks.signInWithEmailLink.mockResolvedValue({
      user: { emailVerified: true, getIdToken },
    });
    localStorage.setItem('indii_founding_artist_email', 'artist@example.com');

    const result = await completeFoundingArtistVerification('Artist@Example.com', true);

    expect(mocks.signInWithEmailLink).toHaveBeenCalledWith(
      mocks.auth,
      'artist@example.com',
      window.location.href,
    );
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(mocks.httpsCallable).toHaveBeenCalledWith(
      mocks.functions,
      'joinFoundingArtistWaitlist',
    );
    expect(mocks.callable).toHaveBeenCalledWith({
      source: 'landing_page',
      majorMilestoneUpdates: true,
    });
    expect(result.queuePosition).toBe(12);
    expect(localStorage.getItem('indii_founding_artist_email')).toBeNull();
  });

  it('does not call the backend for an invalid or expired link', async () => {
    await expect(
      completeFoundingArtistVerification('artist@example.com', true),
    ).rejects.toThrow('invalid or has expired');

    expect(mocks.signInWithEmailLink).not.toHaveBeenCalled();
    expect(mocks.callable).not.toHaveBeenCalled();
  });

  it('enrolls an already signed-in artist only when the verified email matches', async () => {
    const getIdToken = vi.fn().mockResolvedValue('fresh-token');
    mocks.auth.currentUser = {
      email: 'artist@example.com',
      emailVerified: true,
      getIdToken,
    };

    await expect(enrollCurrentVerifiedArtist('ARTIST@example.com', false)).resolves.toMatchObject({
      queuePosition: 12,
    });
    expect(getIdToken).toHaveBeenCalledWith(true);

    mocks.callable.mockClear();
    await expect(enrollCurrentVerifiedArtist('someone-else@example.com', false)).resolves.toBeNull();
    expect(mocks.callable).not.toHaveBeenCalled();
  });
});
