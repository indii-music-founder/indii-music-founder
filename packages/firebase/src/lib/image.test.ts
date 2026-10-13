import { describe, expect, it } from 'vitest';
import { buildImageEditPrompt, EditImageRequestSchema } from './image';
import { FUNCTION_INTELLIGENCE_MODELS } from '../config/models';

// Pure request-contract checks; no authenticated session or provider response is simulated.
describe('image edit request contract', () => {
    it('normalizes the old canvas Flash label into the Fast tier', () => {
        const parsed = EditImageRequestSchema.parse({ image: 'literal-input', prompt: 'Add clown makeup', model: 'flash' });
        expect(parsed.model).toBe('fast');
    });

    it.each([
        'fast', 'pro',
        FUNCTION_INTELLIGENCE_MODELS.IMAGE.FAST,
        FUNCTION_INTELLIGENCE_MODELS.IMAGE.GENERATION,
    ])('accepts the supported image selector %s', model => {
        expect(EditImageRequestSchema.parse({ image: 'literal-input', prompt: 'Edit', model }).model).toBe(model);
    });

    it.each(['flahs', 'gemini-3.8-flash', 'unknown-provider-model'])('rejects invalid image selector %s', model => {
        const parsed = EditImageRequestSchema.safeParse({ image: 'literal-input', prompt: 'Edit', model });
        expect(parsed.success).toBe(false);
        if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(['model']);
    });

    it('retains colored map semantics and the chosen output settings through validation', () => {
        const parsed = EditImageRequestSchema.parse({
            image: 'literal-input', mask: 'literal-mask', prompt: 'PURPLE: makeup. RED: hat.',
            useSemanticMap: true, imageSize: '2K', aspectRatio: '3:4',
        });
        expect(parsed.useSemanticMap).toBe(true);
        expect(parsed.imageSize).toBe('2k');
        expect(parsed.aspectRatio).toBe('3:4');
    });

    it('distinguishes a colored map from a binary mask in the provider instructions', () => {
        const semantic = buildImageEditPrompt('PURPLE: makeup. RED: hat.', true, true);
        expect(semantic).toContain('color-coded region map');
        expect(semantic).toContain("each color's instruction only inside its corresponding region");
        expect(semantic).toContain('Black pixels indicate areas to preserve');
        expect(semantic).toContain('PURPLE: makeup. RED: hat.');
        expect(semantic).toContain('numbered starting at reference image 1');
        expect(semantic).not.toContain('white region');
        const binary = buildImageEditPrompt('Add makeup', true);
        expect(binary).toContain('Edit only the white region');
        expect(binary).toContain('Do not render the mask or annotation colors');
    });

    it('preserves a whole-image instruction when no region mask is present', () => {
        expect(buildImageEditPrompt('Use warm lighting', false)).toBe('Use warm lighting');
    });
});
