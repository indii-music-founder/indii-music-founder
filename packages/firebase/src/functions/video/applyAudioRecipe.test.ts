import { describe, expect, it, vi } from 'vitest';
import { createApplyAudioRecipeHandler } from './applyAudioRecipe';

function createFakeFirestore(sessionData?: Record<string, any>, recipeData?: Record<string, any>) {
    let storedRecipe = recipeData;

    const recipeDoc = {
        get: vi.fn().mockImplementation(async () => ({
            exists: !!storedRecipe,
            data: () => storedRecipe,
        })),
        set: vi.fn().mockImplementation(async (data: any) => {
            storedRecipe = data;
        }),
    };

    const recipesCollection = {
        doc: vi.fn().mockReturnValue(recipeDoc),
    };

    const sessionDoc = {
        get: vi.fn().mockImplementation(async () => ({
            exists: !!sessionData,
            data: () => sessionData,
        })),
        collection: vi.fn().mockReturnValue(recipesCollection),
    };

    const videoSessionsCollection = {
        doc: vi.fn().mockReturnValue(sessionDoc),
    };

    return {
        collection: vi.fn().mockReturnValue(videoSessionsCollection),
    } as unknown as FirebaseFirestore.Firestore;
}

const mockSession = {
    sessionId: 'session-1',
    ownerUid: 'user-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    status: 'completed',
};

describe('applyAudioRecipe Handler', () => {
    it('creates an audio recipe with Natural preset filters', async () => {
        const db = createFakeFirestore(mockSession);
        const handler = createApplyAudioRecipeHandler(db);

        const result = await handler({
            sessionId: 'session-1',
            preset: 'Natural',
        }, 'user-1');

        expect(result.reused).toBe(false);
        expect(result.recipe.preset).toBe('Natural');
        expect(result.recipe.filters.length).toBeGreaterThan(0);
        expect(result.recipe.filters[0]?.operation).toBe('high_pass');
    });

    it('creates an audio recipe with Clean preset filters including denoise and compressor', async () => {
        const db = createFakeFirestore(mockSession);
        const handler = createApplyAudioRecipeHandler(db);

        const result = await handler({
            sessionId: 'session-1',
            preset: 'Clean',
        }, 'user-1');

        expect(result.reused).toBe(false);
        expect(result.recipe.preset).toBe('Clean');
        expect(result.recipe.filters.some((f) => f.operation === 'denoise')).toBe(true);
        expect(result.recipe.filters.some((f) => f.operation === 'compressor')).toBe(true);
    });

    it('denies cross-owner session access', async () => {
        const db = createFakeFirestore(mockSession);
        const handler = createApplyAudioRecipeHandler(db);

        await expect(handler({
            sessionId: 'session-1',
            preset: 'Natural',
        }, 'other-user')).rejects.toThrow('Cross-owner video session access is prohibited.');
    });

    it('reuses existing recipe when parameters match', async () => {
        const existingRecipe = {
            schemaVersion: 'audio-recipe.v1',
            recipeId: 'existing-recipe-1',
            ownerUid: 'user-1',
            organizationId: 'org-1',
            projectId: 'proj-1',
            preset: 'Natural',
            ambienceMode: 'master_only',
            ambienceMixLevelDb: -18,
            duckingMusicLevelDb: -12,
            targetLufs: -16,
            filters: [{ operation: 'high_pass', enabled: true, parameters: {} }],
            createdAt: '2026-07-31T18:00:00.000Z',
        };

        const db = createFakeFirestore(mockSession, existingRecipe);
        const handler = createApplyAudioRecipeHandler(db);

        const result = await handler({
            sessionId: 'session-1',
            preset: 'Natural',
        }, 'user-1');

        expect(result.reused).toBe(true);
        expect(result.recipe.recipeId).toBe('existing-recipe-1');
    });
});
