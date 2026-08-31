import { describe, expect, it, vi } from 'vitest';
import type * as admin from 'firebase-admin';
import type { CallableRequest } from 'firebase-functions/v2/https';
import {
  queueFoundingArtistMilestoneCampaign,
  queueNextFoundingArtistInvitation,
  requireFoundingArtistAdmin,
  selectMilestoneRecipientUids,
  selectNextInvitableArtist,
} from './admin';

interface Ref { kind: 'ref'; path: string; id: string }
interface Query { kind: 'query'; collectionName: string }

function makeDocument(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

function makeFirestore(
  collections: Record<string, Array<{ id: string; data: Record<string, unknown> }>>,
  documents: Record<string, Record<string, unknown>> = {},
) {
  const writes: Array<{ operation: 'set' | 'update'; path: string; data: Record<string, unknown> }> = [];
  const ref = (path: string, id: string): Ref => ({ kind: 'ref', path, id });
  const firestore = {
    collection: vi.fn((collectionName: string) => {
      const query: Query & {
        where: () => unknown;
        orderBy: () => unknown;
        limit: () => unknown;
        doc: (id?: string) => Ref;
      } = {
        kind: 'query',
        collectionName,
        where: () => query,
        orderBy: () => query,
        limit: () => query,
        doc: (id = 'generated-id') => ref(`${collectionName}/${id}`, id),
      };
      return query;
    }),
    runTransaction: vi.fn(async (work: (transaction: unknown) => Promise<unknown>) => work({
      get: vi.fn(async (target: Ref | Query) => {
        if (target.kind === 'query') {
          const docs = (collections[target.collectionName] ?? [])
            .sort((a, b) => Number(a.data.queuePosition ?? 0) - Number(b.data.queuePosition ?? 0))
            .map((document) => makeDocument(document.id, document.data));
          return { docs, empty: docs.length === 0 };
        }
        const data = documents[target.path];
        return { exists: Boolean(data), id: target.id, data: () => data ?? {} };
      }),
      set: vi.fn((target: Ref, data: Record<string, unknown>) => {
        writes.push({ operation: 'set', path: target.path, data });
      }),
      update: vi.fn((target: Ref, data: Record<string, unknown>) => {
        writes.push({ operation: 'update', path: target.path, data });
      }),
    })),
  };
  return { firestore: firestore as unknown as admin.firestore.Firestore, writes };
}

const verifiedWaitlisted = (overrides: Record<string, unknown> = {}) => ({
  email: 'artist@example.com',
  emailVerified: true,
  queuePosition: 1,
  status: 'waitlisted',
  communicationPreferences: { majorMilestoneUpdates: true },
  invitation: null,
  ...overrides,
});

describe('Founding Artist administrator operations', () => {
  const actor = { uid: 'admin-uid', email: 'admin@indii.music' };

  it('requires a verified indii.music administrator identity', () => {
    const request = {
      auth: { uid: 'admin-uid', token: { email: 'ADMIN@indii.music', email_verified: true } },
    } as unknown as CallableRequest<unknown>;
    expect(requireFoundingArtistAdmin(request)).toEqual(actor);

    expect(() => requireFoundingArtistAdmin({
      auth: { uid: 'outsider', token: { email: 'artist@example.com', email_verified: true } },
    } as unknown as CallableRequest<unknown>)).toThrowError(expect.objectContaining({ code: 'permission-denied' }));
  });

  it('selects the first eligible verified artist in queue order', () => {
    const selected = selectNextInvitableArtist([
      makeDocument('unverified', verifiedWaitlisted({ emailVerified: false, queuePosition: 1 })),
      makeDocument('next-uid', verifiedWaitlisted({ queuePosition: 2 })),
      makeDocument('later-uid', verifiedWaitlisted({ queuePosition: 3 })),
    ]);
    expect(selected?.id).toBe('next-uid');
  });

  it('queues one fixed invitation for the first eligible artist without changing lifecycle status early', async () => {
    const { firestore, writes } = makeFirestore({
      foundingArtistWaitlist: [
        { id: 'first-uid', data: verifiedWaitlisted({ queuePosition: 1 }) },
        { id: 'second-uid', data: verifiedWaitlisted({ email: 'second@example.com', queuePosition: 2 }) },
      ],
    });

    const result = await queueNextFoundingArtistInvitation(actor, firestore, () => 'invite-1');

    expect(result).toMatchObject({
      queued: true,
      alreadyQueued: false,
      artistUid: 'first-uid',
      email: 'artist@example.com',
      queuePosition: 1,
      communicationId: 'invite-1',
    });
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operation: 'set',
        path: 'foundingArtistCommunications/invite-1',
        data: expect.objectContaining({ type: 'beta_invitation', status: 'pending', recipientUid: 'first-uid' }),
      }),
      expect.objectContaining({
        operation: 'update',
        path: 'foundingArtistWaitlist/first-uid',
        data: expect.objectContaining({ invitation: expect.objectContaining({ status: 'queued' }) }),
      }),
    ]));
    expect(writes.some((write) => write.data.status === 'invited')).toBe(false);
  });

  it('does not create a second invitation while the first artist is already queued', async () => {
    const { firestore, writes } = makeFirestore({
      foundingArtistWaitlist: [{
        id: 'first-uid',
        data: verifiedWaitlisted({
          invitation: { status: 'queued', communicationId: 'existing-invite' },
        }),
      }],
    });

    const result = await queueNextFoundingArtistInvitation(actor, firestore, () => 'new-invite');
    expect(result).toMatchObject({ alreadyQueued: true, communicationId: 'existing-invite' });
    expect(writes).toHaveLength(0);
  });

  it('snapshots only active verified artists who consented to major milestones', async () => {
    const records = [
      { id: 'eligible', data: verifiedWaitlisted() },
      { id: 'opted-out', data: verifiedWaitlisted({ communicationPreferences: { majorMilestoneUpdates: false } }) },
      { id: 'revoked', data: verifiedWaitlisted({ status: 'revoked' }) },
      { id: 'invited', data: verifiedWaitlisted({ status: 'invited', email: 'invited@example.com' }) },
    ];
    expect(selectMilestoneRecipientUids(records.map((record) => makeDocument(record.id, record.data)))).toEqual([
      'eligible',
      'invited',
    ]);

    const { firestore, writes } = makeFirestore({ foundingArtistWaitlist: records });
    const result = await queueFoundingArtistMilestoneCampaign(actor, {
      requestId: 'ef58860e-5177-4a8d-a461-21d05221b87d',
      subject: 'A real milestone',
      message: 'The working software reached a major milestone.',
    }, firestore);

    expect(result).toEqual({
      campaignId: 'ef58860e-5177-4a8d-a461-21d05221b87d',
      recipientCount: 2,
      alreadyQueued: false,
    });
    expect(writes).toContainEqual(expect.objectContaining({
      path: 'foundingArtistCampaigns/ef58860e-5177-4a8d-a461-21d05221b87d',
      data: expect.objectContaining({ recipientUids: ['eligible', 'invited'], recipientCount: 2 }),
    }));
  });

  it('fails closed instead of silently omitting milestone recipients beyond the safe batch size', async () => {
    const records = Array.from({ length: 1001 }, (_, queuePosition) => ({
      id: `artist-${queuePosition + 1}`,
      data: verifiedWaitlisted({
        email: `artist-${queuePosition + 1}@example.com`,
        queuePosition: queuePosition + 1,
      }),
    }));
    const { firestore, writes } = makeFirestore({ foundingArtistWaitlist: records });

    await expect(queueFoundingArtistMilestoneCampaign(actor, {
      requestId: '3fac13cf-3e3a-467b-b6f7-2a6ee73f20d9',
      subject: 'A real milestone',
      message: 'This must not silently omit anyone.',
    }, firestore)).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(writes).toHaveLength(0);
  });
});
