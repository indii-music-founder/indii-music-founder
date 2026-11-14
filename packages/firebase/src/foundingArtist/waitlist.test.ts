import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type * as admin from 'firebase-admin';
import { acceptVerifiedFoundingArtistInvitation, enrollVerifiedFoundingArtist } from './waitlist';

interface Ref { path: string }
interface StoredSnapshot { exists: boolean; data: () => Record<string, unknown> }

function makeFirestore(initial: Record<string, Record<string, unknown>> = {}) {
  const writes: Array<{ operation: 'set' | 'update'; path: string; data: Record<string, unknown>; options?: unknown }> = [];
  const snapshots = new Map<string, StoredSnapshot>(
    Object.entries(initial).map(([path, data]) => [path, { exists: true, data: () => data }]),
  );
  const ref = (path: string): Ref => ({ path });
  const firestore = {
    collection: vi.fn((name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) })),
    doc: vi.fn((path: string) => ref(path)),
    runTransaction: vi.fn(async (work: (transaction: unknown) => Promise<unknown>) => work({
      get: vi.fn(async (document: Ref) => snapshots.get(document.path) ?? { exists: false, data: () => ({}) }),
      set: vi.fn((document: Ref, data: Record<string, unknown>, options?: unknown) => {
        writes.push({ operation: 'set', path: document.path, data, options });
      }),
      update: vi.fn((document: Ref, data: Record<string, unknown>) => {
        writes.push({ operation: 'update', path: document.path, data });
      }),
    })),
  };
  return { firestore: firestore as unknown as admin.firestore.Firestore, writes };
}

describe('Founding Artist verified waitlist enrollment', () => {
  it('assigns the next server-owned queue position and writes the canonical spine', async () => {
    const { firestore, writes } = makeFirestore({
      'foundingArtistWaitlistMeta/sequence': { nextPosition: 7 },
    });

    const result = await enrollVerifiedFoundingArtist(
      { uid: 'artist-uid', email: ' Artist@Example.com ' },
      { source: 'landing_page', majorMilestoneUpdates: true },
      firestore,
    );

    expect(result).toEqual({ status: 'waitlisted', queuePosition: 7, alreadyJoined: false });
    expect(writes.map((write) => write.path)).toEqual(expect.arrayContaining([
      'foundingArtistWaitlistMeta/sequence',
      'foundingArtistWaitlist/artist-uid',
      'foundingArtistEvents/artist-uid_verified_enrollment',
    ]));
    const artistWrite = writes.find((write) => write.path === 'foundingArtistWaitlist/artist-uid');
    expect(artistWrite?.data).toMatchObject({
      uid: 'artist-uid',
      email: 'artist@example.com',
      status: 'waitlisted',
      queuePosition: 7,
      emailVerified: true,
      communicationPreferences: expect.objectContaining({ majorMilestoneUpdates: true }),
    });
  });

  it('is idempotent for the same verified account and does not consume another position', async () => {
    const email = 'artist@example.com';
    const emailHash = createHash('sha256').update(email).digest('hex');
    const { firestore, writes } = makeFirestore({
      'foundingArtistWaitlist/artist-uid': {
        emailHash,
        queuePosition: 4,
        status: 'waitlisted',
        communicationPreferences: { majorMilestoneUpdates: true },
      },
      [`foundingArtistEmailIndex/${emailHash}`]: { uid: 'artist-uid' },
      'foundingArtistWaitlistMeta/sequence': { nextPosition: 8 },
    });

    const result = await enrollVerifiedFoundingArtist(
      { uid: 'artist-uid', email },
      { source: 'landing_page', majorMilestoneUpdates: true },
      firestore,
    );

    expect(result).toEqual({ status: 'waitlisted', queuePosition: 4, alreadyJoined: true });
    expect(writes).toHaveLength(0);
  });

  it('updates an existing artist milestone preference without changing their queue position', async () => {
    const email = 'artist@example.com';
    const emailHash = createHash('sha256').update(email).digest('hex');
    const { firestore, writes } = makeFirestore({
      'foundingArtistWaitlist/artist-uid': {
        emailHash,
        queuePosition: 4,
        status: 'waitlisted',
        communicationPreferences: { majorMilestoneUpdates: true },
      },
      [`foundingArtistEmailIndex/${emailHash}`]: { uid: 'artist-uid' },
      'foundingArtistWaitlistMeta/sequence': { nextPosition: 8 },
    });

    const result = await enrollVerifiedFoundingArtist(
      { uid: 'artist-uid', email },
      { source: 'landing_page', majorMilestoneUpdates: false },
      firestore,
    );

    expect(result).toEqual({ status: 'waitlisted', queuePosition: 4, alreadyJoined: true });
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operation: 'update',
        path: 'foundingArtistWaitlist/artist-uid',
        data: expect.objectContaining({ 'communicationPreferences.majorMilestoneUpdates': false }),
      }),
      expect.objectContaining({
        operation: 'set',
        path: expect.stringMatching(/^foundingArtistEvents\/[0-9a-f-]+$/),
        data: expect.objectContaining({ type: 'milestone_preference_changed', majorMilestoneUpdates: false }),
      }),
    ]));
    expect(writes.some((write) => write.path === 'foundingArtistWaitlistMeta/sequence')).toBe(false);
  });

  it('rejects an email index already owned by another account', async () => {
    const email = 'artist@example.com';
    const emailHash = createHash('sha256').update(email).digest('hex');
    const { firestore } = makeFirestore({
      [`foundingArtistEmailIndex/${emailHash}`]: { uid: 'different-uid' },
      'foundingArtistWaitlistMeta/sequence': { nextPosition: 8 },
    });

    await expect(enrollVerifiedFoundingArtist(
      { uid: 'artist-uid', email },
      { source: 'landing_page', majorMilestoneUpdates: false },
      firestore,
    )).rejects.toMatchObject({ code: 'already-exists' });
  });

  it('preserves and records custom source slugs such as replit_passport', async () => {
    const { firestore, writes } = makeFirestore({
      'foundingArtistWaitlistMeta/sequence': { nextPosition: 12 },
    });

    const result = await enrollVerifiedFoundingArtist(
      { uid: 'artist-replit-123', email: 'producer@replit.dev' },
      { source: 'replit_passport', majorMilestoneUpdates: true },
      firestore,
    );

    expect(result).toEqual({ status: 'waitlisted', queuePosition: 12, alreadyJoined: false });
    const eventWrite = writes.find((write) => write.path === 'foundingArtistEvents/artist-replit-123_verified_enrollment');
    expect(eventWrite?.data).toMatchObject({
      source: 'replit_passport',
      type: 'verified_enrollment',
    });
  });

  it('preserves invited or accepted status when an enrolled artist updates preferences', async () => {
    const email = 'artist@example.com';
    const emailHash = createHash('sha256').update(email).digest('hex');
    const { firestore } = makeFirestore({
      'foundingArtistWaitlist/artist-uid': {
        emailHash,
        queuePosition: 2,
        status: 'invited',
        communicationPreferences: { majorMilestoneUpdates: true },
      },
      [`foundingArtistEmailIndex/${emailHash}`]: { uid: 'artist-uid' },
    });

    const result = await enrollVerifiedFoundingArtist(
      { uid: 'artist-uid', email },
      { source: 'landing_page', majorMilestoneUpdates: true },
      firestore,
    );

    expect(result).toEqual({ status: 'invited', queuePosition: 2, alreadyJoined: true });
  });
});

describe('Founding Artist invitation acceptance', () => {
  it('transitions an invited artist to accepted, records the lifecycle event, and activates beta participation metadata', async () => {
    const email = 'invited@example.com';
    const emailHash = createHash('sha256').update(email).digest('hex');
    const { firestore, writes } = makeFirestore({
      'foundingArtistWaitlist/artist-uid': {
        emailHash,
        queuePosition: 5,
        status: 'invited',
        invitation: { status: 'sent', communicationId: 'comm-123' },
      },
    });

    const result = await acceptVerifiedFoundingArtistInvitation(
      { uid: 'artist-uid', email: ' Invited@Example.com ' },
      firestore,
    );

    expect(result).toEqual({
      status: 'accepted',
      queuePosition: 5,
      alreadyAccepted: false,
      betaAccessActive: true,
    });
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operation: 'update',
        path: 'foundingArtistWaitlist/artist-uid',
        data: expect.objectContaining({
          status: 'accepted',
          'invitation.status': 'accepted',
        }),
      }),
      expect.objectContaining({
        operation: 'set',
        path: 'users/artist-uid',
        data: expect.objectContaining({
          foundingArtistBeta: expect.objectContaining({
            status: 'accepted',
            queuePosition: 5,
            communicationId: 'comm-123',
          }),
        }),
        options: { merge: true },
      }),
      expect.objectContaining({
        operation: 'set',
        path: 'foundingArtistEvents/artist-uid_invitation_accepted_comm-123',
        data: expect.objectContaining({
          uid: 'artist-uid',
          type: 'invitation_accepted',
          fromStatus: 'invited',
          toStatus: 'accepted',
          communicationId: 'comm-123',
          queuePosition: 5,
        }),
      }),
    ]));
    const userWrite = writes.find((write) => write.path === 'users/artist-uid');
    expect(userWrite?.data).not.toHaveProperty('tier');
    expect(userWrite?.data).not.toHaveProperty('subscriptionTier');
    expect(userWrite?.data).not.toHaveProperty('isFounder');
  });

  it('is idempotent when the invitation has already been accepted', async () => {
    const email = 'accepted@example.com';
    const emailHash = createHash('sha256').update(email).digest('hex');
    const { firestore, writes } = makeFirestore({
      'foundingArtistWaitlist/artist-uid': {
        emailHash,
        queuePosition: 3,
        status: 'accepted',
      },
    });

    const result = await acceptVerifiedFoundingArtistInvitation(
      { uid: 'artist-uid', email },
      firestore,
    );

    expect(result).toEqual({
      status: 'accepted',
      queuePosition: 3,
      alreadyAccepted: true,
      betaAccessActive: true,
    });
    expect(writes).toHaveLength(0);
  });

  it('rejects acceptance when the account has not been invited yet or has no waitlist record', async () => {
    const email = 'waiting@example.com';
    const emailHash = createHash('sha256').update(email).digest('hex');
    const waitingDb = makeFirestore({
      'foundingArtistWaitlist/artist-uid': {
        emailHash,
        queuePosition: 9,
        status: 'waitlisted',
      },
    });
    await expect(
      acceptVerifiedFoundingArtistInvitation({ uid: 'artist-uid', email }, waitingDb.firestore),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(waitingDb.writes).toHaveLength(0);

    const missingDb = makeFirestore({});
    await expect(
      acceptVerifiedFoundingArtistInvitation({ uid: 'artist-uid', email }, missingDb.firestore),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('rejects acceptance when the verified email does not match the waitlist emailHash', async () => {
    const otherHash = createHash('sha256').update('original@example.com').digest('hex');
    const { firestore, writes } = makeFirestore({
      'foundingArtistWaitlist/artist-uid': {
        emailHash: otherHash,
        queuePosition: 1,
        status: 'invited',
      },
    });

    await expect(
      acceptVerifiedFoundingArtistInvitation({ uid: 'artist-uid', email: 'attacker@example.com' }, firestore),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(writes).toHaveLength(0);
  });
});
