import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversionEvent } from '@indii/shared';

const mocks = vi.hoisted(() => ({
  serverTimestamp: { kind: 'server-timestamp' },
  increment: vi.fn((amount: number) => ({ kind: 'increment', amount })),
}));

vi.mock('firebase-admin', () => {
  const firestore = vi.fn();
  Object.assign(firestore, {
    FieldValue: {
      serverTimestamp: () => mocks.serverTimestamp,
      increment: mocks.increment,
    },
  });
  return { firestore };
});

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
      this.name = 'HttpsError';
    }
  },
  onCall: vi.fn((_options, handler) => handler),
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('../config/secrets', () => ({ arcjetKey: { value: vi.fn() } }));
vi.mock('../functions/security/arcjet', () => ({
  protectAnonymousSignupRequest: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('../middleware/appCheck', () => ({ validateAppCheckV2: vi.fn() }));

import { registerPresave, type PresaveRegisterInput } from './presaveRegister';

interface FakeFirestoreState {
  campaignExists: boolean;
  leadExists: boolean;
  campaign: Record<string, unknown>;
  leadWrites: Record<string, unknown>[];
  campaignUpdates: Record<string, unknown>[];
  throwOnTransaction: boolean;
}

function campaignRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownerId: 'artist-uid',
    title: 'Midnight Release',
    releaseDate: { toMillis: () => 1_800_000_000_000 },
    coverArtUrl: 'https://cdn.indii.music/cover.jpg',
    links: { spotify: 'https://open.spotify.com/album/123' },
    captureEmails: true,
    capturePhones: false,
    themeColor: '#7259ff',
    status: 'active',
    leadCount: 0,
    createdAt: { toMillis: () => 1_700_000_000_000 },
    updatedAt: { toMillis: () => 1_700_000_000_000 },
    ...overrides,
  };
}

function fakeFirestore(overrides: Partial<FakeFirestoreState> = {}) {
  const state: FakeFirestoreState = {
    campaignExists: true,
    leadExists: false,
    campaign: campaignRecord(),
    leadWrites: [],
    campaignUpdates: [],
    throwOnTransaction: false,
    ...overrides,
  };
  const campaignRef = {
    kind: 'campaign',
    collection: () => ({ doc: () => ({ kind: 'lead' }) }),
  };
  const firestore = {
    collection: () => ({ doc: () => campaignRef }),
    runTransaction: async (callback: (transaction: {
      get: (ref: { kind: string }) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
      set: (_ref: unknown, data: Record<string, unknown>) => void;
      update: (_ref: unknown, data: Record<string, unknown>) => void;
    }) => Promise<void>) => {
      if (state.throwOnTransaction) throw new Error('firestore unavailable');
      await callback({
        get: async (ref) => ref.kind === 'campaign'
          ? { exists: state.campaignExists, data: () => state.campaignExists ? state.campaign : undefined }
          : { exists: state.leadExists, data: () => state.leadExists ? { leadId: 'lead_12345678' } : undefined },
        set: (_ref, data) => { state.leadWrites.push(data); },
        update: (_ref, data) => { state.campaignUpdates.push(data); },
      });
    },
  };
  return { firestore, state };
}

const validInput: PresaveRegisterInput = {
  campaignId: 'campaign_12345678',
  leadId: 'lead_12345678',
  dsp: 'spotify',
  email: 'FAN@EXAMPLE.COM',
  optInMarketing: true,
};

beforeEach(() => {
  mocks.increment.mockClear();
});

describe('registerPresave', () => {
  it('persists the lead, increments once, and durably emits the artist conversion', async () => {
    const { firestore, state } = fakeFirestore();
    const enqueue = vi.fn(async () => true);

    const result = await registerPresave(validInput, { firestore: firestore as never, enqueue });

    expect(result).toEqual({
      presaved: true,
      campaignId: validInput.campaignId,
      leadId: validInput.leadId,
    });
    expect(state.leadWrites).toEqual([expect.objectContaining({
      leadId: validInput.leadId,
      campaignId: validInput.campaignId,
      ownerId: 'artist-uid',
      dsp: 'spotify',
      email: 'fan@example.com',
      optInMarketing: true,
      collectedAt: mocks.serverTimestamp,
    })]);
    expect(state.campaignUpdates).toEqual([expect.objectContaining({
      leadCount: { kind: 'increment', amount: 1 },
    })]);
    expect(enqueue).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 'conversion-event.v1',
      artistId: 'artist-uid',
      eventType: 'presave',
      campaignId: validInput.campaignId,
      metadata: {
        presavePlatform: 'spotify',
        leadId: validInput.leadId,
      },
    }));
  });

  it('uses the deterministic lead id to deduplicate retries without inflating leadCount', async () => {
    const { firestore, state } = fakeFirestore({ leadExists: true });
    const enqueue = vi.fn(async () => true);

    const first = await registerPresave(validInput, { firestore: firestore as never, enqueue });
    const second = await registerPresave(validInput, { firestore: firestore as never, enqueue });

    expect(first.presaved).toBe(true);
    expect(second.presaved).toBe(true);
    expect(state.campaignUpdates).toHaveLength(0);
    expect(state.leadWrites).toHaveLength(2);
    const calls = enqueue.mock.calls as unknown as Array<[ConversionEvent]>;
    expect(calls[0]?.[0].eventId).toBe(calls[1]?.[0].eventId);
  });

  it('returns an honest unavailable result when the campaign does not exist', async () => {
    const { firestore, state } = fakeFirestore({ campaignExists: false });
    const enqueue = vi.fn(async () => true);

    const result = await registerPresave(validInput, { firestore: firestore as never, enqueue });

    expect(result).toEqual(expect.objectContaining({ presaved: false, reason: 'CAMPAIGN_NOT_FOUND' }));
    expect(state.leadWrites).toHaveLength(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('enforces the configured contact fields and explicit marketing consent', async () => {
    const { firestore, state } = fakeFirestore();
    const enqueue = vi.fn(async () => true);

    const missingEmail = await registerPresave(
      { ...validInput, email: undefined },
      { firestore: firestore as never, enqueue },
    );
    const missingConsent = await registerPresave(
      { ...validInput, optInMarketing: false },
      { firestore: firestore as never, enqueue },
    );

    expect(missingEmail).toEqual(expect.objectContaining({ presaved: false, reason: 'CAMPAIGN_UNAVAILABLE' }));
    expect(missingConsent).toEqual(expect.objectContaining({ presaved: false, reason: 'CAMPAIGN_UNAVAILABLE' }));
    expect(state.leadWrites).toHaveLength(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does not throw at the fan when Firestore is unavailable', async () => {
    const { firestore } = fakeFirestore({ throwOnTransaction: true });

    await expect(registerPresave(validInput, {
      firestore: firestore as never,
      enqueue: vi.fn(async () => true),
    })).resolves.toEqual(expect.objectContaining({ presaved: false, reason: 'FIRESTORE_ERROR' }));
  });

  it('does not claim success when the conversion outbox cannot confirm durability', async () => {
    const { firestore } = fakeFirestore();

    const result = await registerPresave(validInput, {
      firestore: firestore as never,
      enqueue: vi.fn(async () => false),
    });

    expect(result).toEqual(expect.objectContaining({ presaved: false, reason: 'FIRESTORE_ERROR' }));
  });
});
