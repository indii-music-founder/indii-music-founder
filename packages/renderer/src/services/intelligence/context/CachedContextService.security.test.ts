import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getDoc: vi.fn(),
    callable: vi.fn().mockResolvedValue({ data: { success: true } }),
    httpsCallable: vi.fn(),
    auth: { currentUser: { uid: 'user-123' } } as { currentUser: { uid: string } | null },
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    db: { name: 'db' },
    functions: { name: 'functions' },
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn((_db: unknown, collection: string, id: string) => ({ collection, id })),
    getDoc: mocks.getDoc,
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: mocks.httpsCallable,
}));

import { CachedContextService } from './CachedContextService';

describe('CachedContextService secure persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.currentUser = { uid: 'user-123' };
        mocks.httpsCallable.mockReturnValue(mocks.callable);
    });

    it('reads only the authenticated user-namespaced cache document', async () => {
        mocks.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({ id: 'cache-resource', expireTime: Date.now() + 600_000 }),
        });

        await expect(CachedContextService.findCache('abc123')).resolves.toBe('cache-resource');
        expect(mocks.getDoc).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'ai_context_cache',
            id: 'user-123_abc123',
        }));
    });

    it('does not probe shared cache state while signed out', async () => {
        mocks.auth.currentUser = null;
        await expect(CachedContextService.findCache('abc123')).resolves.toBeNull();
        expect(mocks.getDoc).not.toHaveBeenCalled();
    });

    it('registers cache metadata through the server callable instead of Firestore writes', async () => {
        await CachedContextService.registerCache(
            'abc123',
            'projects/indii-music-founder/locations/us-central1/cachedContents/cache_123',
            3_600,
        );

        expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'registerAiContextCache');
        expect(mocks.callable).toHaveBeenCalledWith({
            hash: 'abc123',
            resourceName: 'projects/indii-music-founder/locations/us-central1/cachedContents/cache_123',
            ttlSeconds: 3_600,
        });
    });
});
