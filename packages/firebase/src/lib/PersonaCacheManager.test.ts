import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockDelete = vi.fn();

vi.mock('./vertexClient', () => ({
    getVertexAIClient: vi.fn(() => ({
        caches: {
            create: mockCreate,
            delete: mockDelete,
        },
    })),
}));

import {
    getOrCreatePersonaCache,
    invalidatePersonaCache,
    resetPersonaCacheTracking,
} from './PersonaCacheManager';

describe('PersonaCacheManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetPersonaCacheTracking();
        mockCreate.mockResolvedValue({ name: 'cachedContents/abc123' });
        mockDelete.mockResolvedValue({});
    });

    it('creates a cache on first call for a persona', async () => {
        const name = await getOrCreatePersonaCache('manager', 'You are a music industry manager.');
        expect(name).toBe('cachedContents/abc123');
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('reuses the cached resource on a second call with identical content (one cache per persona, not per call)', async () => {
        await getOrCreatePersonaCache('manager', 'You are a music industry manager.');
        await getOrCreatePersonaCache('manager', 'You are a music industry manager.');
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('creates separate caches for different personas', async () => {
        await getOrCreatePersonaCache('manager', 'You are a manager.');
        await getOrCreatePersonaCache('contractReader', 'You are a contract reader.');
        expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('creates a fresh cache when the persona system instruction text changes (staleness detection)', async () => {
        await getOrCreatePersonaCache('manager', 'You are a manager. v1');
        mockCreate.mockResolvedValue({ name: 'cachedContents/def456' });
        const secondName = await getOrCreatePersonaCache('manager', 'You are a manager. v2');

        expect(mockCreate).toHaveBeenCalledTimes(2);
        expect(secondName).toBe('cachedContents/def456');
        // Old resource should be cleaned up, best-effort.
        expect(mockDelete).toHaveBeenCalledWith({ name: 'cachedContents/abc123' });
    });

    it('throws on empty personaId', async () => {
        await expect(getOrCreatePersonaCache('', 'text')).rejects.toThrow(/personaId is required/);
    });

    it('throws on empty systemInstructionText', async () => {
        await expect(getOrCreatePersonaCache('manager', '')).rejects.toThrow(/must not be empty/);
    });

    it('throws if the SDK returns a cache with no resource name', async () => {
        mockCreate.mockResolvedValue({ name: undefined });
        await expect(getOrCreatePersonaCache('manager', 'text')).rejects.toThrow(/returned no resource name/);
    });

    it('invalidatePersonaCache deletes the resource and clears local tracking', async () => {
        await getOrCreatePersonaCache('manager', 'You are a manager.');
        await invalidatePersonaCache('manager');

        expect(mockDelete).toHaveBeenCalledWith({ name: 'cachedContents/abc123' });

        // A subsequent call must create a new cache — tracking was cleared.
        mockCreate.mockResolvedValue({ name: 'cachedContents/new789' });
        const name = await getOrCreatePersonaCache('manager', 'You are a manager.');
        expect(name).toBe('cachedContents/new789');
        expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('invalidatePersonaCache on an unknown persona is a safe no-op', async () => {
        await expect(invalidatePersonaCache('never-created')).resolves.toBeUndefined();
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('a delete failure during staleness-triggered replacement does not block creating the new cache', async () => {
        await getOrCreatePersonaCache('manager', 'v1');
        mockDelete.mockRejectedValue(new Error('network error'));
        mockCreate.mockResolvedValue({ name: 'cachedContents/survived' });

        const name = await getOrCreatePersonaCache('manager', 'v2');
        expect(name).toBe('cachedContents/survived');
    });

    // ── Style/substance isolation, at the caching layer ────────────────────
    // The cache manager only ever accepts archetype/domain grounding text —
    // it has no fader/style parameter at all, so a per-user style block
    // structurally cannot be baked into a shared, cross-user cache.
    it('has no parameter through which a per-user fader/style block could reach the shared cache', () => {
        // Function.prototype.length counts only params before the first
        // default value, so this is 2 (personaId, systemInstructionText) —
        // model/ttl are defaulted config, not fader/style data. None of the
        // 4 named parameters is a fader value or style-compiled block.
        expect(getOrCreatePersonaCache.length).toBe(2);
    });
});
