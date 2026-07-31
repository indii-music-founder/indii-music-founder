import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * These tests exist to hold the two properties that keep this executor from
 * costing an artist money: it may only ever POST to publish/pause endpoints,
 * and it must not spend while the swarm is halted.
 */

// ─── Firestore harness ───────────────────────────────────────────────────────
// The package-wide setup mock returns a flat document with no nested
// collections, so the users/{uid}/analyticsTokens/{platform} chain needs a
// purpose-built stub here.

const stub = vi.hoisted(() => {
    interface StubDoc { exists: boolean; data: () => Record<string, unknown> | undefined }

    const docs = new Map<string, StubDoc>();
    const added: Array<{ path: string; payload: Record<string, unknown> }> = [];
    let addShouldFail = false;

    const makeDocRef = (path: string) => ({
        get: async (): Promise<StubDoc> => docs.get(path) ?? { exists: false, data: () => undefined },
        collection: (name: string) => makeCollectionRef(`${path}/${name}`),
    });

    const makeCollectionRef = (path: string) => ({
        doc: (id: string) => makeDocRef(`${path}/${id}`),
        add: async (payload: Record<string, unknown>) => {
            if (addShouldFail) throw new Error('firestore unavailable');
            added.push({ path, payload });
            return { id: 'generated-id' };
        },
    });

    return {
        docs, added, makeCollectionRef,
        setAddShouldFail: (value: boolean) => { addShouldFail = value; },
    };
});

const { docs, added } = stub;

vi.mock('firebase-admin', () => ({
    firestore: Object.assign(
        () => ({ collection: (name: string) => stub.makeCollectionRef(name) }),
        { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } },
    ),
}));

vi.mock('firebase-functions/v2', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { pauseAd, pushAdCreative, recordAgentAction } from './facebookAdsExecutor.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = 'artist-uid';
const AD_ACCOUNT_ID = '123456789';

const PAYLOAD = {
    name: 'Summer Single — Launch',
    body: 'New single out now.',
    imageUrl: 'https://cdn.indii.music/creative.jpg',
    linkUrl: 'https://indii.music/artist/summer',
};

function connectMeta(overrides: Record<string, unknown> = {}) {
    docs.set(`users/${USER_ID}/analyticsTokens/instagram`, {
        exists: true,
        data: () => ({
            accessToken: 'long-lived-token',
            facebookPageId: 'page-9876',
            expiresAt: Date.now() + 86_400_000,
            ...overrides,
        }),
    });
}

function setSwarmActive(isActive: boolean) {
    docs.set(`users/${USER_ID}/settings/marketingSwarm`, {
        exists: true,
        data: () => ({ isActive }),
    });
}

function okJson(body: unknown) {
    return { ok: true, status: 200, json: async () => body, text: async () => '' } as unknown as Response;
}

function errorJson(status: number, message: string) {
    return {
        ok: false, status,
        json: async () => ({ error: { message } }),
        text: async () => message,
    } as unknown as Response;
}

/** Fetcher for the happy path: image upload, then creative assembly. */
function publishFetcher() {
    return vi.fn()
        .mockResolvedValueOnce(okJson({ images: { 'creative.jpg': { hash: 'img-hash-1' } } }))
        .mockResolvedValueOnce(okJson({ id: 'creative-555' }));
}

beforeEach(() => {
    docs.clear();
    added.length = 0;
    stub.setAddShouldFail(false);
    connectMeta();
    setSwarmActive(true);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('pushAdCreative', () => {
    it('uploads the asset then builds the creative around the stored Page ID', async () => {
        const fetcher = publishFetcher();

        const result = await pushAdCreative(USER_ID, AD_ACCOUNT_ID, PAYLOAD, fetcher);

        expect(result).toEqual({ success: true, creativeId: 'creative-555' });

        const [uploadCall, creativeCall] = fetcher.mock.calls;
        expect(String(uploadCall[0])).toBe(`https://graph.facebook.com/v23.0/act_${AD_ACCOUNT_ID}/adimages`);
        expect(String(creativeCall[0])).toBe(`https://graph.facebook.com/v23.0/act_${AD_ACCOUNT_ID}/adcreatives`);

        // The Page ID comes from the stored connection, never a placeholder.
        const body = new URLSearchParams(String(creativeCall[1].body));
        const storySpec = JSON.parse(body.get('object_story_spec') ?? '{}');
        expect(storySpec.page_id).toBe('page-9876');
        expect(storySpec.link_data.image_hash).toBe('img-hash-1');
    });

    it('sends the access token in the body, never the query string', async () => {
        const fetcher = publishFetcher();

        await pushAdCreative(USER_ID, AD_ACCOUNT_ID, PAYLOAD, fetcher);

        for (const [url, init] of fetcher.mock.calls) {
            expect(String(url)).not.toContain('access_token');
            expect(String(init.body)).toContain('access_token=long-lived-token');
            expect(init.method).toBe('POST');
        }
    });

    it('refuses to publish while the swarm is halted, without calling Meta', async () => {
        setSwarmActive(false);
        const fetcher = vi.fn();

        const result = await pushAdCreative(USER_ID, AD_ACCOUNT_ID, PAYLOAD, fetcher);

        expect(result).toMatchObject({ success: false, code: 'SWARM_HALTED' });
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('treats an absent swarm setting as enabled', async () => {
        docs.delete(`users/${USER_ID}/settings/marketingSwarm`);

        const result = await pushAdCreative(USER_ID, AD_ACCOUNT_ID, PAYLOAD, publishFetcher());

        expect(result).toEqual({ success: true, creativeId: 'creative-555' });
    });

    it('fails before any network call when Meta is not connected', async () => {
        docs.delete(`users/${USER_ID}/analyticsTokens/instagram`);
        const fetcher = vi.fn();

        const result = await pushAdCreative(USER_ID, AD_ACCOUNT_ID, PAYLOAD, fetcher);

        expect(result).toMatchObject({ success: false, code: 'META_NOT_CONNECTED' });
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('fails with a reconnect hint on an expired token', async () => {
        connectMeta({ expiresAt: Date.now() - 1000 });

        const result = await pushAdCreative(USER_ID, AD_ACCOUNT_ID, PAYLOAD, vi.fn());

        expect(result).toMatchObject({ success: false, code: 'META_TOKEN_EXPIRED' });
    });

    it('fails when the connection carries no Facebook Page', async () => {
        connectMeta({ facebookPageId: '' });

        const result = await pushAdCreative(USER_ID, AD_ACCOUNT_ID, PAYLOAD, vi.fn());

        expect(result).toMatchObject({ success: false, code: 'META_PAGE_MISSING' });
    });

    it('rejects a creative with neither image nor video', async () => {
        const result = await pushAdCreative(
            USER_ID, AD_ACCOUNT_ID,
            { name: 'Empty', body: 'x', linkUrl: 'https://indii.music' },
            vi.fn(),
        );

        expect(result).toMatchObject({ success: false, code: 'ASSET_UPLOAD_FAILED' });
    });

    it('surfaces the Graph error message when Meta rejects the write', async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce(okJson({ images: { 'creative.jpg': { hash: 'img-hash-1' } } }))
            .mockResolvedValueOnce(errorJson(400, 'Invalid ad account'));

        const result = await pushAdCreative(USER_ID, AD_ACCOUNT_ID, PAYLOAD, fetcher);

        expect(result).toMatchObject({ success: false, code: 'GRAPH_WRITE_FAILED' });
        expect(result.success === false && result.error).toContain('Invalid ad account');
    });

    it('fails when Meta accepts the upload but returns no image hash', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(okJson({ images: {} }));

        const result = await pushAdCreative(USER_ID, AD_ACCOUNT_ID, PAYLOAD, fetcher);

        expect(result).toMatchObject({ success: false, code: 'ASSET_UPLOAD_FAILED' });
    });

    it('records both the owner-visible log and the global audit entry', async () => {
        await pushAdCreative(USER_ID, AD_ACCOUNT_ID, PAYLOAD, publishFetcher());

        expect(added.map(entry => entry.path)).toEqual(
            expect.arrayContaining(['timelineExecutionLogs', `users/${USER_ID}/marketingAgentLogs`]),
        );
        const feedEntry = added.find(entry => entry.path.endsWith('marketingAgentLogs'));
        expect(feedEntry?.payload).toMatchObject({ actionType: 'launched_ad', status: 'success' });
    });

    it('records a failed action when publishing fails', async () => {
        setSwarmActive(false);

        await pushAdCreative(USER_ID, AD_ACCOUNT_ID, PAYLOAD, vi.fn());

        const feedEntry = added.find(entry => entry.path.endsWith('marketingAgentLogs'));
        expect(feedEntry?.payload).toMatchObject({ status: 'failed', actionType: 'launched_ad' });
    });
});

describe('pauseAd', () => {
    it('posts a PAUSED status to the ad node', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(okJson({ success: true }));

        const result = await pauseAd(USER_ID, '778899', 'CPA above campaign bound.', fetcher);

        expect(result).toEqual({ success: true, adId: '778899' });
        expect(String(fetcher.mock.calls[0][0])).toBe('https://graph.facebook.com/v23.0/778899');
        expect(String(fetcher.mock.calls[0][1].body)).toContain('status=PAUSED');
    });

    it('still pauses while the swarm is halted — stopping spend is always allowed', async () => {
        setSwarmActive(false);
        const fetcher = vi.fn().mockResolvedValueOnce(okJson({ success: true }));

        const result = await pauseAd(USER_ID, '778899', 'Artist halted the swarm.', fetcher);

        expect(result).toEqual({ success: true, adId: '778899' });
        expect(fetcher).toHaveBeenCalledOnce();
    });

    it('refuses an ad id that is not a bare node, blocking path traversal', async () => {
        const fetcher = vi.fn();

        const result = await pauseAd(USER_ID, 'act_123/insights', 'probe', fetcher);

        expect(result).toMatchObject({ success: false, code: 'FORBIDDEN_ENDPOINT' });
        expect(fetcher).not.toHaveBeenCalled();
    });
});

describe('write-only contract', () => {
    it('rejects every read-shaped endpoint an agent might reach for', async () => {
        const readEndpoints = [
            'act_123/insights',
            'me/adaccounts',
            '778899/insights',
            'act_123/ads',
        ];

        for (const endpoint of readEndpoints) {
            const fetcher = vi.fn();
            const result = await pauseAd(USER_ID, endpoint, 'probe', fetcher);

            expect(result).toMatchObject({ success: false, code: 'FORBIDDEN_ENDPOINT' });
            expect(fetcher).not.toHaveBeenCalled();
        }
    });
});

describe('recordAgentAction', () => {
    it('never throws when the audit write fails — the ad is already live', async () => {
        stub.setAddShouldFail(true);

        await expect(recordAgentAction({
            userId: USER_ID,
            agentName: 'Media Buyer',
            actionType: 'launched_ad',
            message: 'published',
            status: 'success',
        })).resolves.toBeUndefined();
    });
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { pushAdCreative } from './facebookAdsExecutor';

const mockGet = vi.fn();
const mockAdd = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: vi.fn((collName: string) => {
      if (collName === 'users') {
        return {
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({
                get: mockGet,
              })),
            })),
          })),
        };
      }
      if (collName === 'timelineExecutionLogs') {
        return {
          add: mockAdd,
        };
      }
      return {};
    }),
  }),
}));

vi.mock('axios');

describe('facebookAdsExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails if Meta analytics account doc does not exist', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    const result = await pushAdCreative('user123', 'act_100', {
      name: 'Summer Single Ad',
      body: 'Listen now!',
      linkUrl: 'https://spotify.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('User has not connected a Meta account');
  });

  it('fails if Page ID is missing', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ accessToken: 'mock_token' }),
    });

    const result = await pushAdCreative('user123', '100', {
      name: 'Summer Single Ad',
      body: 'Listen now!',
      linkUrl: 'https://spotify.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Meta Page ID is missing');
  });

  it('successfully uploads asset, creates ad creative, and logs audit trail', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ accessToken: 'mock_token', pageId: 'page_999' }),
    });

    vi.mocked(axios.post)
      .mockResolvedValueOnce({
        data: {
          images: {
            'cover.jpg': { hash: 'hash_abc123' },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'creative_45678',
        },
      });

    mockAdd.mockResolvedValueOnce({ id: 'log_001' });

    const result = await pushAdCreative('user123', 'act_100', {
      name: 'Summer Single Ad',
      body: 'Listen now!',
      imageUrl: 'https://example.com/cover.jpg',
      linkUrl: 'https://spotify.com',
    });

    expect(result.success).toBe(true);
    expect(result.creativeId).toBe('creative_45678');
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'fb_ad_creative_pushed',
        creativeId: 'creative_45678',
        status: 'success',
      })
    );
  });
});
