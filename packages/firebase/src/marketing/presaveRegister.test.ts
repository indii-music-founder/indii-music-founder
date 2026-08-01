import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * These tests verify presave deduplication and conversion event emission.
 */

const USER_ID = 'artist-uid';
const TRACK_ID = 'track-spotify-123';
const PLATFORM = 'spotify';

// ─── Test fixtures ───────────────────────────────────────────────────────

const stub = vi.hoisted(() => {
  const db = {
    leads: new Map<string, Record<string, unknown>>(),
    campaigns: new Map<string, Record<string, unknown>>(),
    outbox: [] as Record<string, unknown>[],
    presaveExists: new Map<string, boolean>(),
  };

  return { db };
});

const { db } = stub;

vi.mock('firebase-admin', () => {
  const firestoreFunction = () => {
    let queryCount = 0;
    let whereFilters: Array<[string, string, unknown]> = [];

    const buildQuery = () => ({
      where: (field: string, op: string, value: unknown) => {
        whereFilters.push([field, op, value]);
        return buildQuery();
      },
      limit: () => ({
        get: async () => {
          // Check if any presave exists in our map
          const existingKey = Array.from(db.presaveExists.keys()).find((key) => {
            // If we're checking for presaves and found one, return it
            if (db.presaveExists.get(key)) return true;
            return false;
          });

          whereFilters = [];
          queryCount++;
          return {
            empty: !existingKey,
            docs: existingKey ? [{ data: () => ({ [existingKey]: existingKey }) }] : [],
          };
        },
      }),
    });

    return {
      collection: (name: string) => ({
        doc: (id?: string) => {
          const docId = id || 'generated-id';
          return {
            id: docId,
            get: async () => ({
              exists: false,
              data: () => undefined,
            }),
            collection: (subName: string) => ({
              doc: (subId?: string) => ({
                id: subId || `${Math.random().toString(36).slice(2, 9)}`,
                set: async (data: Record<string, unknown>) => {
                  db.leads.set(`${name}/${docId}/${subName}/${subId}`, data);
                },
              }),
              add: async (data: Record<string, unknown>) => {
                const leadDocId = `doc-${Math.random().toString(36).slice(2, 9)}`;
                db.leads.set(`${name}/${docId}/${subName}/${leadDocId}`, data);
                return { id: leadDocId };
              },
            }),
            update: async (data: Record<string, unknown>) => {
              // Mock update
            },
          };
        },
        add: async (data: Record<string, unknown>) => {
          const docId = `campaign-${Math.random().toString(36).slice(2, 9)}`;
          db.campaigns.set(docId, data);
          return { id: docId };
        },
      }),
      collectionGroup: (name: string) => buildQuery(),
      FieldValue: {
        serverTimestamp: () => 'SERVER_TIMESTAMP',
        increment: (n: number) => ({ _increment: n }),
      },
    };
  };

  // Attach FieldValue to the function object for admin.firestore.FieldValue access
  Object.assign(firestoreFunction, {
    FieldValue: {
      serverTimestamp: () => 'SERVER_TIMESTAMP',
      increment: (n: number) => ({ _increment: n }),
    },
  });

  return { firestore: firestoreFunction };
});


// Must mock firebase-admin first, before presaveRegister imports it
vi.mock('firebase-admin', () => {
  const firestoreFunction = () => {
    let queryCount = 0;
    let whereFilters: Array<[string, string, unknown]> = [];

    const buildQuery = () => ({
      where: (field: string, op: string, value: unknown) => {
        whereFilters.push([field, op, value]);
        return buildQuery();
      },
      limit: () => ({
        get: async () => {
          // Check if any presave exists in our map
          const existingKey = Array.from(db.presaveExists.keys()).find((key) => {
            // If we're checking for presaves and found one, return it
            if (db.presaveExists.get(key)) return true;
            return false;
          });

          whereFilters = [];
          queryCount++;
          return {
            empty: !existingKey,
            docs: existingKey ? [{ data: () => ({ [existingKey]: existingKey }) }] : [],
          };
        },
      }),
    });

    return {
      collection: (name: string) => ({
        doc: (id?: string) => {
          const docId = id || 'generated-id';
          return {
            id: docId,
            get: async () => ({
              exists: false,
              data: () => undefined,
            }),
            collection: (subName: string) => ({
              doc: (subId?: string) => ({
                id: subId || `${Math.random().toString(36).slice(2, 9)}`,
                set: async (data: Record<string, unknown>) => {
                  db.leads.set(`${name}/${docId}/${subName}/${subId}`, data);
                },
              }),
              add: async (data: Record<string, unknown>) => {
                const leadDocId = `doc-${Math.random().toString(36).slice(2, 9)}`;
                db.leads.set(`${name}/${docId}/${subName}/${leadDocId}`, data);
                return { id: leadDocId };
              },
            }),
            update: async (data: Record<string, unknown>) => {
              // Mock update
            },
          };
        },
        add: async (data: Record<string, unknown>) => {
          const docId = `campaign-${Math.random().toString(36).slice(2, 9)}`;
          db.campaigns.set(docId, data);
          return { id: docId };
        },
      }),
      collectionGroup: (name: string) => buildQuery(),
      FieldValue: {
        serverTimestamp: () => 'SERVER_TIMESTAMP',
        increment: (n: number) => ({ _increment: n }),
      },
    };
  };

  // Attach FieldValue to the function object for admin.firestore.FieldValue access
  Object.assign(firestoreFunction, {
    FieldValue: {
      serverTimestamp: () => 'SERVER_TIMESTAMP',
      increment: (n: number) => ({ _increment: n }),
    },
  });

  return { firestore: firestoreFunction };
});

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
      this.name = 'HttpsError';
    }
  },
  onCall: vi.fn(),
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('./conversionEventOutbox.ts', () => ({
  enqueueConversionEvent: async (event: Record<string, unknown>) => {
    db.outbox.push(event);
  },
}));

import { registerPresave } from './presaveRegister';

beforeEach(() => {
  db.campaigns.clear();
  db.leads.clear();
  db.outbox.length = 0;
  db.presaveExists.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe('presaveRegister', () => {
  it('registers a new presave and returns leadId + campaignId', async () => {
    const result = await registerPresave(USER_ID, TRACK_ID, PLATFORM, '');

    expect(result.presaved).toBe(true);
    if (result.presaved) {
      expect(result.leadId).toBeTruthy();
      expect(result.campaignId).toBeTruthy();
    }
  });

  it('creates a campaign if campaignId is not provided', async () => {
    const result = await registerPresave(USER_ID, TRACK_ID, PLATFORM, '');

    if (result.presaved) {
      expect(db.campaigns.has(result.campaignId)).toBe(true);
    }
  });

  it('uses provided campaignId when given', async () => {
    const campaignId = 'existing-campaign-id';
    const result = await registerPresave(USER_ID, TRACK_ID, PLATFORM, campaignId);

    expect(result.presaved).toBe(true);
    if (result.presaved) {
      expect(result.campaignId).toBe(campaignId);
    }
  });

  it('emits a conversion event for each presave', async () => {
    await registerPresave(USER_ID, TRACK_ID, PLATFORM, '');

    expect(db.outbox.length).toBe(1);
    const event = db.outbox[0];
    expect(event.schemaVersion).toBe('conversion-event.v1');
    expect(event.eventType).toBe('presave');
    expect(event.artistId).toBe(USER_ID);
    expect(event.platform).toBe('presave');
  });

  it('includes trackId and presavePlatform in conversion metadata', async () => {
    await registerPresave(USER_ID, TRACK_ID, PLATFORM, '');

    const event = db.outbox[0] as any;
    expect(event.metadata?.trackId).toBe(TRACK_ID);
    expect(event.metadata?.presavePlatform).toBe(PLATFORM);
  });

  it('refuses duplicate presaves by (userId, trackId, platform)', async () => {
    // Mark presave as existing
    db.presaveExists.set(`${USER_ID}:${TRACK_ID}:${PLATFORM}`, true);

    const result = await registerPresave(USER_ID, TRACK_ID, PLATFORM, '');

    expect(result.presaved).toBe(false);
    if (!result.presaved) {
      expect(result.reason).toBe('ALREADY_PRESAVED');
    }
    expect(db.outbox.length).toBe(0);
  });


  it('allows presaves of same track on different platforms', async () => {
    // First presave on spotify
    const result1 = await registerPresave(USER_ID, TRACK_ID, 'spotify', '');
    expect(result1.presaved).toBe(true);

    // Second presave same track, different platform (not marked as existing)
    const result2 = await registerPresave(USER_ID, TRACK_ID, 'apple_music', '');
    expect(result2.presaved).toBe(true);
    expect(db.outbox.length).toBe(2);
  });
});
