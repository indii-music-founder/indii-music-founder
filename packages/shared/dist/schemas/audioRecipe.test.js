import { describe, expect, it } from 'vitest';
import { AudioRecipeSchema } from './audioRecipe';
describe('AudioRecipe Schema Validation', () => {
    const validRecipe = {
        schemaVersion: 'audio-recipe.v1',
        recipeId: 'rec-1',
        ownerUid: 'uid-1',
        organizationId: 'org-1',
        projectId: 'proj-1',
        preset: 'Clean',
        ambienceMode: 'blend_ambience',
        ambienceMixLevelDb: -18,
        duckingMusicLevelDb: -14,
        targetLufs: -16,
        filters: [
            {
                operation: 'high_pass',
                enabled: true,
                parameters: { cutoffHz: 80 },
            },
            {
                operation: 'denoise',
                enabled: true,
                parameters: { reductionDb: 6 },
            },
        ],
        createdAt: new Date().toISOString(),
    };
    it('validates a correct AudioRecipe payload', () => {
        const result = AudioRecipeSchema.safeParse(validRecipe);
        expect(result.success).toBe(true);
    });
    it('rejects targetLufs outside allowed range', () => {
        const invalid = { ...validRecipe, targetLufs: -5 };
        const result = AudioRecipeSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });
});
