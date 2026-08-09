import { beforeEach, describe, expect, it, vi } from 'vitest';

const bindAccount = vi.fn();
const clearCache = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/intelligence/IntelligenceResponseCache', () => ({
    aiCache: { clear: clearCache },
}));
vi.mock('@/services/audio/OfflineStorageService', () => ({
    offlineStorageService: { clear: clearCache },
}));
vi.mock('@/services/cache/MediaCacheManager', () => ({
    clearInitializedMediaCache: clearCache,
}));
vi.mock('@/services/storage/repository', () => ({
    clearAccountBoundRepositoryState: clearCache,
}));
vi.mock('@/services/memory/EventLogger', () => ({
    eventLogger: { clear: clearCache },
}));
vi.mock('@/services/security/ExecApprovalService', () => ({
    execApprovalService: { bindAccount },
}));

import { enforceAccountBoundaryCleanup } from './AccountBoundaryCleanup';

describe('enforceAccountBoundaryCleanup', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        bindAccount.mockClear();
        clearCache.mockClear();
    });

    it('purges account-owned browser state before binding a different user', async () => {
        localStorage.setItem('indii:account-boundary-cleanup', '1');
        localStorage.setItem('indii:last-authenticated-account', 'user-a');
        localStorage.setItem('workflow_draft', 'private workflow');
        localStorage.setItem('indii_community_webhook_config', 'private webhook');
        localStorage.setItem('indii_events_session-a', 'private messages');
        localStorage.setItem('indii-screenwriter-draft-v2:user-a:project-a', 'private screenplay');
        localStorage.setItem('indii_founder_funnel_queue', 'private analytics identifiers');
        sessionStorage.setItem('yt_google_access_token:user-a', 'private token');
        sessionStorage.setItem('indii:oauth:spotify', 'private verifier');

        await enforceAccountBoundaryCleanup('user-b');

        expect(localStorage.getItem('workflow_draft')).toBeNull();
        expect(localStorage.getItem('indii_community_webhook_config')).toBeNull();
        expect(localStorage.getItem('indii_events_session-a')).toBeNull();
        expect(localStorage.getItem('indii-screenwriter-draft-v2:user-a:project-a')).toBeNull();
        expect(localStorage.getItem('indii_founder_funnel_queue')).toBeNull();
        expect(sessionStorage.getItem('yt_google_access_token:user-a')).toBeNull();
        expect(sessionStorage.getItem('indii:oauth:spotify')).toBeNull();
        expect(localStorage.getItem('indii:last-authenticated-account')).toBe('user-b');
        expect(bindAccount).toHaveBeenCalledWith('user-b');
        expect(clearCache).toHaveBeenCalled();
    });

    it('preserves caches when the authenticated identity has not changed', async () => {
        localStorage.setItem('indii:account-boundary-cleanup', '1');
        localStorage.setItem('indii:last-authenticated-account', 'user-a');
        localStorage.setItem('workflow_draft', 'same user workflow');

        await enforceAccountBoundaryCleanup('user-a');

        expect(localStorage.getItem('workflow_draft')).toBe('same user workflow');
        expect(clearCache).not.toHaveBeenCalled();
        expect(bindAccount).toHaveBeenCalledWith('user-a');
    });

    it('serializes rapid identity changes so the newest account is bound last', async () => {
        localStorage.setItem('indii:account-boundary-cleanup', '1');
        localStorage.setItem('indii:last-authenticated-account', 'user-a');
        let releaseCleanup!: () => void;
        const blockedCleanup = new Promise<void>(resolve => {
            releaseCleanup = resolve;
        });
        clearCache.mockImplementation(() => blockedCleanup);

        const userBCleanup = enforceAccountBoundaryCleanup('user-b');
        const userCCleanup = enforceAccountBoundaryCleanup('user-c');
        await Promise.resolve();
        expect(bindAccount).not.toHaveBeenCalled();

        releaseCleanup();
        await Promise.all([userBCleanup, userCCleanup]);

        expect(bindAccount.mock.calls.map(call => call[0])).toEqual(['user-b', 'user-c']);
        expect(localStorage.getItem('indii:last-authenticated-account')).toBe('user-c');
    });

    it('does not bind or advance the account marker when private cleanup fails', async () => {
        localStorage.setItem('indii:account-boundary-cleanup', '1');
        localStorage.setItem('indii:last-authenticated-account', 'user-a');
        clearCache.mockRejectedValueOnce(new Error('cache unavailable'));

        await expect(enforceAccountBoundaryCleanup('user-b')).rejects.toThrow(
            'Failed to clear 1 account-owned cache(s)',
        );

        expect(bindAccount).not.toHaveBeenCalled();
        expect(localStorage.getItem('indii:last-authenticated-account')).toBe('user-a');
    });
});
