import { beforeEach, describe, expect, it, vi } from 'vitest';

const docs = new Map<string, Record<string, unknown>>();
const createdReceipts: Array<{ path: string; data: Record<string, unknown> }> = [];
const updatedDocs: Array<{ path: string; data: Record<string, unknown> }> = [];

function makeDocRef(path: string) {
  return {
    path,
    id: path.split('/').pop()!,
    get: async () => {
      const data = docs.get(path);
      return {
        exists: data !== undefined,
        id: path.split('/').pop()!,
        data: () => data,
      };
    },
    collection: (sub: string) => makeCollectionRef(`${path}/${sub}`),
  };
}

function makeCollectionRef(path: string) {
  return {
    path,
    doc: (id: string) => makeDocRef(`${path}/${id}`),
    orderBy: () => ({
      offset: () => ({
        limit: () => ({
          get: async () => ({
            docs: [...docs.entries()]
              .filter(([key]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
              .map(([key, value]) => ({
                id: key.split('/').pop()!,
                data: () => value,
              })),
          }),
        }),
      }),
    }),
  };
}

vi.mock('firebase-admin/firestore', () => ({
  FieldPath: { documentId: () => '__name__' },
  getFirestore: () => ({
    collection: (name: string) => makeCollectionRef(name),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const tx = {
        get: async (ref: ReturnType<typeof makeDocRef>) => ref.get(),
        create: (ref: ReturnType<typeof makeDocRef>, data: Record<string, unknown>) => {
          docs.set(ref.path, data);
          createdReceipts.push({ path: ref.path, data });
        },
        update: (ref: ReturnType<typeof makeDocRef>, patch: Record<string, unknown>) => {
          const existing = docs.get(ref.path) ?? {};
          docs.set(ref.path, { ...existing, ...patch });
          updatedDocs.push({ path: ref.path, data: patch });
        },
      };
      return fn(tx);
    },
  }),
}));

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

import { executeSdkDistribution } from './sdkDistributions';

describe('executeSdkDistribution submitDistribution (ISSUE-1602)', () => {
  const uid = 'artist-1';
  const distId = 'dist-1';
  const trackId = 'track-1';
  const releaseId = 'release-1';

  beforeEach(() => {
    docs.clear();
    createdReceipts.length = 0;
    updatedDocs.length = 0;

    docs.set(`users/${uid}/distributions/${distId}`, {
      userId: uid,
      trackId,
      platforms: ['spotify', 'apple'],
      status: 'draft',
      createdAt: '2026-11-26T00:00:00.000Z',
      updatedAt: '2026-11-26T00:00:00.000Z',
    });
    docs.set(`users/${uid}/tracks/${trackId}`, {
      userId: uid,
      title: 'Midnight Signal',
      audioUrl: 'gs://indii-bucket/users/artist-1/audio/master.wav',
      clearanceStatus: 'cleared',
    });
    docs.set(`users/${uid}/releases/${releaseId}`, {
      userId: uid,
      title: 'Midnight Signal Single',
      coverArtUrl: 'gs://indii-bucket/users/artist-1/artwork/cover-3000.png',
      masterAudioUrl: 'gs://indii-bucket/users/artist-1/audio/master.wav',
      rightsCleared: true,
    });
  });

  it('fails closed when no verified release binding is supplied', async () => {
    await expect(
      executeSdkDistribution(uid, 'submitDistribution', distId, {}, {}),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('fails closed when the bound release belongs to another user', async () => {
    docs.set(`users/${uid}/releases/${releaseId}`, {
      userId: 'other-artist',
      coverArtUrl: 'gs://indii-bucket/other/cover.png',
      rightsCleared: true,
    });

    await expect(
      executeSdkDistribution(uid, 'submitDistribution', distId, { releaseId }, {}),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('fails closed when master audio or cover artwork is missing', async () => {
    docs.set(`users/${uid}/releases/${releaseId}`, {
      userId: uid,
      rightsCleared: true,
    });

    await expect(
      executeSdkDistribution(uid, 'submitDistribution', distId, { releaseId }, {}),
    ).rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringContaining('cover artwork') });

    docs.set(`users/${uid}/tracks/${trackId}`, {
      userId: uid,
      title: 'No Audio Track',
      clearanceStatus: 'cleared',
    });
    docs.set(`users/${uid}/releases/${releaseId}`, {
      userId: uid,
      coverArtUrl: 'gs://indii-bucket/cover.png',
      rightsCleared: true,
    });

    await expect(
      executeSdkDistribution(uid, 'submitDistribution', distId, { releaseId }, {}),
    ).rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringContaining('master audio') });
  });

  it('fails closed when rights/sample clearance is uncleared or disputed', async () => {
    docs.set(`users/${uid}/tracks/${trackId}`, {
      userId: uid,
      audioUrl: 'gs://indii-bucket/audio.wav',
      clearanceStatus: 'uncleared',
    });

    await expect(
      executeSdkDistribution(uid, 'submitDistribution', distId, { releaseId }, {}),
    ).rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringContaining('clearance') });
  });

  it('submits atomically when release, media, clearance, and distributor targets are verified and writes an immutable receipt', async () => {
    const submitted = await executeSdkDistribution(
      uid,
      'submitDistribution',
      distId,
      { releaseId },
      {},
    ) as Record<string, unknown>;

    expect(submitted).toMatchObject({
      id: distId,
      trackId,
      releaseId,
      platforms: ['spotify', 'apple'],
      status: 'submitted',
    });
    expect(typeof submitted.submittedAt).toBe('string');
    expect(typeof submitted.submissionReceiptId).toBe('string');
    expect(createdReceipts).toHaveLength(1);
    expect(createdReceipts[0]!.path).toContain(`users/${uid}/distributionReceipts/`);
    expect(createdReceipts[0]!.data).toMatchObject({
      distributionId: distId,
      releaseId,
      trackId,
      userId: uid,
      status: 'submitted',
    });

    // Rejects duplicate submission once no longer in draft status.
    await expect(
      executeSdkDistribution(uid, 'submitDistribution', distId, { releaseId }, {}),
    ).rejects.toMatchObject({ code: 'already-exists' });
  });

  it('supports binding against an owner-verified proprietaryIngestionReleases record', async () => {
    docs.delete(`users/${uid}/releases/${releaseId}`);
    docs.set(`proprietaryIngestionReleases/${releaseId}`, {
      userId: uid,
      coverUrl: 'gs://indii-bucket/cover.png',
      audioUrl: 'gs://indii-bucket/master.wav',
      clearanceStatus: 'verified',
    });

    const submitted = await executeSdkDistribution(
      uid,
      'submitDistribution',
      distId,
      { releaseId },
      {},
    ) as Record<string, unknown>;

    expect(submitted.status).toBe('submitted');
    expect(submitted.releaseId).toBe(releaseId);
  });
});
