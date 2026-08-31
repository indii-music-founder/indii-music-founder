import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type * as admin from 'firebase-admin';
import { enrollVerifiedFoundingArtist } from './waitlist';

interface Ref { path: string }
interface StoredSnapshot { exists: boolean; data: () => Record<string, unknown> }

function makeFirestore(initial: Record<string, Record<string, unknown>> = {}) {
  const writes: Array<{ path: string; data: Record<string, unknown>; options?: unknown }> = [];
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
        writes.push({ path: document.path, data, options });
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
      'foundingArtistWaitlist/artist-uid': { emailHash, queuePosition: 4, status: 'waitlisted' },
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
});
