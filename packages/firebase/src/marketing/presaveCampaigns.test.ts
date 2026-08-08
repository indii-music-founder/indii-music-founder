import { describe, expect, it, vi } from 'vitest';

const adminMocks = vi.hoisted(() => ({
  serverTimestamp: { kind: 'server-timestamp' },
}));

vi.mock('firebase-admin', () => {
  const firestore = vi.fn();
  Object.assign(firestore, {
    FieldValue: { serverTimestamp: () => adminMocks.serverTimestamp },
    Timestamp: { fromMillis: (value: number) => ({ toMillis: () => value }) },
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
vi.mock('firebase-functions/v2', () => ({ logger: { info: vi.fn() } }));
vi.mock('../config/secrets', () => ({ arcjetKey: { value: vi.fn() } }));
vi.mock('../functions/security/arcjet', () => ({
  protectAnonymousSignupRequest: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('../middleware/appCheck', () => ({ validateAppCheckV2: vi.fn() }));

import {
  getPublicPreSaveCampaign,
  isApprovedDspUrl,
  savePreSaveCampaign,
} from './presaveCampaigns';

function validCampaign(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Midnight Release',
    releaseDate: 1_800_000_000_000,
    coverArtUrl: 'https://cdn.indii.music/cover.jpg',
    links: { spotify: 'https://open.spotify.com/album/123' },
    captureEmails: true,
    capturePhones: false,
    themeColor: '#7259ff',
    ...overrides,
  };
}

function storedCampaign(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: 'artist-uid',
    ...validCampaign(),
    releaseDate: { toMillis: () => 1_800_000_000_000 },
    status: 'active',
    leadCount: 7,
    createdAt: { toMillis: () => 1_700_000_000_000 },
    updatedAt: { toMillis: () => 1_700_000_000_000 },
    ...overrides,
  };
}

function fakeFirestore(options: { exists?: boolean; data?: Record<string, unknown> } = {}) {
  const writes: Array<{ data: Record<string, unknown>; options: Record<string, unknown> }> = [];
  const ref = {
    id: 'campaign_12345678',
    get: vi.fn(async () => ({
      exists: options.exists ?? false,
      data: () => options.data,
    })),
    set: vi.fn(async (data: Record<string, unknown>, setOptions: Record<string, unknown>) => {
      writes.push({ data, options: setOptions });
    }),
  };
  return {
    firestore: { collection: () => ({ doc: () => ref }) },
    ref,
    writes,
  };
}

describe('pre-save campaign persistence', () => {
  it('creates a durable active campaign and returns the Firestore id', async () => {
    const { firestore, writes } = fakeFirestore();

    const campaignId = await savePreSaveCampaign(
      'artist-uid',
      validCampaign(),
      firestore as never,
    );

    expect(campaignId).toBe('campaign_12345678');
    expect(writes).toEqual([{
      data: expect.objectContaining({
        ownerId: 'artist-uid',
        title: 'Midnight Release',
        status: 'active',
        leadCount: 0,
        createdAt: adminMocks.serverTimestamp,
        updatedAt: adminMocks.serverTimestamp,
      }),
      options: { merge: false },
    }]);
  });

  it('rejects redirects outside each DSP official HTTPS domain', async () => {
    const { firestore, writes } = fakeFirestore();

    await expect(savePreSaveCampaign('artist-uid', validCampaign({
      links: { spotify: 'https://attacker.example/spotify' },
    }), firestore as never)).rejects.toMatchObject({ code: 'invalid-argument' });

    await expect(savePreSaveCampaign('artist-uid', validCampaign({
      coverArtUrl: 'https://',
    }), firestore as never)).rejects.toMatchObject({ code: 'invalid-argument' });

    expect(writes).toHaveLength(0);
    expect(isApprovedDspUrl('spotify', 'http://open.spotify.com/album/123')).toBe(false);
    expect(isApprovedDspUrl('appleMusic', 'https://music.apple.com/us/album/123')).toBe(true);
  });

  it('preserves creation evidence and lead count when the owner publishes changes', async () => {
    const existing = storedCampaign();
    const { firestore, writes } = fakeFirestore({ exists: true, data: existing });

    await savePreSaveCampaign('artist-uid', validCampaign({
      campaignId: 'campaign_12345678',
      title: 'Midnight Release (Updated)',
    }), firestore as never);

    expect(writes[0]?.data).toEqual(expect.objectContaining({
      ownerId: 'artist-uid',
      title: 'Midnight Release (Updated)',
      leadCount: 7,
      createdAt: existing.createdAt,
    }));
  });

  it('never lets another artist overwrite a campaign', async () => {
    const { firestore, writes } = fakeFirestore({ exists: true, data: storedCampaign() });

    await expect(savePreSaveCampaign('other-artist', validCampaign({
      campaignId: 'campaign_12345678',
    }), firestore as never)).rejects.toMatchObject({ code: 'permission-denied' });

    expect(writes).toHaveLength(0);
  });

  it('returns only the public campaign projection', async () => {
    const { firestore } = fakeFirestore({ exists: true, data: storedCampaign() });

    const campaign = await getPublicPreSaveCampaign('campaign_12345678', firestore as never);

    expect(campaign).toEqual({
      id: 'campaign_12345678',
      title: 'Midnight Release',
      releaseDate: 1_800_000_000_000,
      coverArtUrl: 'https://cdn.indii.music/cover.jpg',
      links: { spotify: 'https://open.spotify.com/album/123' },
      captureEmails: true,
      capturePhones: false,
      themeColor: '#7259ff',
      status: 'active',
    });
    expect(campaign).not.toHaveProperty('ownerId');
    expect(campaign).not.toHaveProperty('leadCount');
  });
});
