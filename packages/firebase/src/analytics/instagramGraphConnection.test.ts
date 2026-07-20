import { describe, expect, it, vi } from 'vitest';

import { MetaInstagramConnectionError, exchangeFacebookInstagramConnection, resolveFacebookInstagramConnection } from './instagramGraphConnection.js';

const input = {
    code: 'authorization-code',
    redirectUri: 'https://app.indii.music/auth/instagram/callback',
    appId: 'meta-app-id',
    appSecret: 'meta-app-secret',
};

function okJson(body: unknown) {
    return { ok: true, json: vi.fn().mockResolvedValue(body), text: vi.fn() } as never;
}

describe('exchangeFacebookInstagramConnection', () => {
    it('uses the Facebook Graph token and Page graph to resolve the publishing account', async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce(okJson({ access_token: 'short-token', expires_in: 3600 }))
            .mockResolvedValueOnce(okJson({ access_token: 'long-token', expires_in: 5_184_000 }))
            .mockResolvedValueOnce(okJson({ data: [{ id: 'page-1', name: 'indii', instagram_business_account: { id: 'ig-1', username: 'indii_music' } }] }));

        const result = await exchangeFacebookInstagramConnection(input, fetcher);

        expect(result).toMatchObject({
            accessToken: 'long-token',
            facebookPageId: 'page-1',
            igUserId: 'ig-1',
            instagramUsername: 'indii_music',
            expiresIn: 5_184_000,
        });
        expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
            expect.stringContaining('graph.facebook.com/v23.0/oauth/access_token'),
            expect.stringContaining('graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token'),
            expect.stringContaining('graph.facebook.com/v23.0/me/accounts'),
        ]);
    });

    it('requires an explicit Page choice when more than one linked account is available', async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce(okJson({ access_token: 'short-token' }))
            .mockResolvedValueOnce(okJson({ access_token: 'long-token', expires_in: 5_184_000 }))
            .mockResolvedValueOnce(okJson({ data: [
                { id: 'page-1', name: 'indii', instagram_business_account: { id: 'ig-1', username: 'indii_music' } },
                { id: 'page-2', name: 'another', instagram_business_account: { id: 'ig-2', username: 'another_music' } },
            ] }));

        await expect(exchangeFacebookInstagramConnection(input, fetcher)).rejects.toMatchObject({
            code: 'PAGE_SELECTION_REQUIRED',
            pages: [
                { facebookPageId: 'page-1', instagramBusinessAccountId: 'ig-1', instagramUsername: 'indii_music' },
                { facebookPageId: 'page-2', instagramBusinessAccountId: 'ig-2', instagramUsername: 'another_music' },
            ],
        } satisfies Partial<MetaInstagramConnectionError>);
    });

    it('keeps the token server-side while returning only safe Page choices for a deferred selection', async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce(okJson({ access_token: 'short-token' }))
            .mockResolvedValueOnce(okJson({ access_token: 'long-token', expires_in: 5_184_000 }))
            .mockResolvedValueOnce(okJson({ data: [
                { id: 'page-1', name: 'indii', instagram_business_account: { id: 'ig-1', username: 'indii_music' } },
                { id: 'page-2', name: 'another', instagram_business_account: { id: 'ig-2', username: 'another_music' } },
            ] }));

        const result = await resolveFacebookInstagramConnection(input, fetcher);

        expect(result.accessToken).toBe('long-token');
        expect(result.pages).toEqual([
            { facebookPageId: 'page-1', facebookPageName: 'indii', instagramBusinessAccountId: 'ig-1', instagramUsername: 'indii_music' },
            { facebookPageId: 'page-2', facebookPageName: 'another', instagramBusinessAccountId: 'ig-2', instagramUsername: 'another_music' },
        ]);
    });

    it('fails closed when no selected Page is linked to an Instagram professional account', async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce(okJson({ access_token: 'short-token' }))
            .mockResolvedValueOnce(okJson({ access_token: 'long-token', expires_in: 5_184_000 }))
            .mockResolvedValueOnce(okJson({ data: [{ id: 'page-1', name: 'indii' }] }));

        await expect(exchangeFacebookInstagramConnection({ ...input, facebookPageId: 'page-1' }, fetcher))
            .rejects.toMatchObject({ code: 'NO_LINKED_INSTAGRAM_BUSINESS_ACCOUNT' } satisfies Partial<MetaInstagramConnectionError>);
    });
});
