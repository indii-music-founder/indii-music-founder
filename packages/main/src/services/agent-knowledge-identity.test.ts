import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    verifiedAgentKnowledgeUid,
    clearVerifiedAgentKnowledgeCache,
} from './agent-knowledge-identity';

function makeJwt(expSeconds: number): string {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'user-123', exp: expSeconds })).toString('base64url');
    return `${header}.${payload}.signature`;
}

describe('verifiedAgentKnowledgeUid', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        clearVerifiedAgentKnowledgeCache();
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('forwards X-Firebase-AppCheck and desktop origin headers to getProfile', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { id: 'uid-abc' } }),
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const token = makeJwt(Math.floor(Date.now() / 1000) + 3600);
        const uid = await verifiedAgentKnowledgeUid(token, 'app-check-token-xyz');

        expect(uid).toBe('uid-abc');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            'https://us-central1-indii-music-founder.cloudfunctions.net/getProfile',
            expect.objectContaining({
                method: 'GET',
                redirect: 'error',
                headers: expect.objectContaining({
                    Authorization: `Bearer ${token}`,
                    'X-Firebase-AppCheck': 'app-check-token-xyz',
                    Origin: 'https://indii.music',
                    Referer: 'https://indii.music/',
                    'X-App-Client-Type': 'electron-desktop-app',
                }),
            }),
        );
    });

    it('caches verified uid and deduplicates concurrent Boardroom seat calls for the same idToken', async () => {
        let resolveFetch!: (value: unknown) => void;
        const fetchMock = vi.fn().mockImplementation(
            () => new Promise((resolve) => { resolveFetch = resolve; }),
        );
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const token = makeJwt(Math.floor(Date.now() / 1000) + 3600);
        const p1 = verifiedAgentKnowledgeUid(token, 'ac-1');
        const p2 = verifiedAgentKnowledgeUid(token, 'ac-1');
        const p3 = verifiedAgentKnowledgeUid(token, 'ac-1');

        resolveFetch({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { id: 'uid-cached' } }),
        });

        const [u1, u2, u3] = await Promise.all([p1, p2, p3]);
        expect([u1, u2, u3]).toEqual(['uid-cached', 'uid-cached', 'uid-cached']);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Subsequent seat call hits the in-memory cache without another HTTP request
        const u4 = await verifiedAgentKnowledgeUid(token, 'ac-1');
        expect(u4).toBe('uid-cached');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not cache failed verification responses and includes HTTP status in error', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 401 })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true, data: { id: 'uid-recovered' } }),
            });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const token = makeJwt(Math.floor(Date.now() / 1000) + 3600);
        await expect(verifiedAgentKnowledgeUid(token)).rejects.toThrow('Signed-in account verification failed (401)');

        const recovered = await verifiedAgentKnowledgeUid(token, 'ac-valid');
        expect(recovered).toBe('uid-recovered');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
