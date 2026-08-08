import { describe, expect, it, vi } from 'vitest';
import {
  syncPlatformStatsForUser,
  type SocialStatsDependencies,
} from './social-stats-sync';

function harness(initial: Record<string, Record<string, unknown>> = {}) {
  const documents = new Map(Object.entries(initial));
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
  const fetchMock = vi.fn();
  const dependencies: SocialStatsDependencies = {
    userDocument: (uid) => ({
      collection: (collection) => ({
        doc: (id) => {
          const path = `users/${uid}/${collection}/${id}`;
          return {
            get: async () => ({
              exists: documents.has(path),
              data: () => documents.get(path),
            }),
            set: async (data) => {
              writes.push({ path, data });
              documents.set(path, { ...(documents.get(path) ?? {}), ...data });
            },
          };
        },
      }),
    }),
    fetch: fetchMock as unknown as typeof fetch,
    now: () => 1_800_000_000_000,
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  };
  return { dependencies, fetchMock, writes };
}

describe('syncPlatformStatsForUser', () => {
  it('does not let a stale cache imply a connection when no server token exists', async () => {
    const { dependencies, fetchMock } = harness({
      'users/user-1/platformStats/spotify': { followers: 999, fetchedAt: 1_700_000_000_000 },
    });

    const result = await syncPlatformStatsForUser('user-1', { platform: 'spotify' }, dependencies);

    expect(result).toMatchObject({
      connected: false,
      authorized: false,
      liveSyncOk: false,
      cacheOnly: false,
      error: 'not_connected',
    });
    expect(result.followers).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads analyticsTokens server-side and persists a successful live receipt', async () => {
    const { dependencies, fetchMock, writes } = harness({
      'users/user-1/analyticsTokens/spotify': {
        accessToken: 'server-secret-token',
        expiresAt: 1_900_000_000_000,
      },
    });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ followers: { total: 321 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const result = await syncPlatformStatsForUser('user-1', {
      platform: 'spotify',
      artistId: 'artist123',
    }, dependencies);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/artists/artist123',
      expect.objectContaining({ headers: { Authorization: 'Bearer server-secret-token' } }),
    );
    expect(result).toMatchObject({
      followers: 321,
      connected: true,
      authorized: true,
      liveSyncOk: true,
      cacheOnly: false,
    });
    expect(writes).toEqual([expect.objectContaining({
      path: 'users/user-1/platformStats/spotify',
      data: expect.objectContaining({ followers: 321, liveSyncOk: true }),
    })]);
  });

  it('labels a failed live request as cache-only without overwriting the cache', async () => {
    const { dependencies, fetchMock, writes } = harness({
      'users/user-1/socialTokens/tiktok': {
        accessToken: 'legacy-server-token',
        expiresAt: 1_900_000_000_000,
      },
      'users/user-1/platformStats/tiktok': { followers: 77, likes: 400, fetchedAt: 1_700_000_000_000 },
    });
    fetchMock.mockResolvedValue(new Response('rate limited', { status: 429 }));

    const result = await syncPlatformStatsForUser('user-1', { platform: 'tiktok' }, dependencies);

    expect(result).toMatchObject({
      followers: 77,
      likes: 400,
      connected: true,
      authorized: true,
      liveSyncOk: false,
      cacheOnly: true,
      error: 'live_sync_failed',
    });
    expect(writes).toHaveLength(0);
  });

  it('does not use cached data after authorization expires', async () => {
    const { dependencies, fetchMock } = harness({
      'users/user-1/analyticsTokens/instagram': {
        accessToken: 'expired-token',
        expiresAt: 1_700_000_000_000,
      },
      'users/user-1/platformStats/instagram': { followers: 88, fetchedAt: 1_700_000_000_000 },
    });

    const result = await syncPlatformStatsForUser('user-1', { platform: 'instagram' }, dependencies);

    expect(result).toMatchObject({
      connected: false,
      authorized: false,
      liveSyncOk: false,
      cacheOnly: false,
      error: 'authorization_expired',
    });
    expect(result.followers).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
