import { describe, expect, it } from 'vitest';
import { resolveDirectVideoFirstFrame } from './directVideoInputs';

describe('resolveDirectVideoFirstFrame', () => {
    it('gives the explicit first frame precedence over references', () => {
        expect(resolveDirectVideoFirstFrame('frame-a', 'ingredient-b', 'character-c')).toBe('frame-a');
    });

    it('uses documented fallbacks only when no explicit frame exists', () => {
        expect(resolveDirectVideoFirstFrame(undefined, 'ingredient-b', 'character-c')).toBe('ingredient-b');
        expect(resolveDirectVideoFirstFrame(undefined, undefined, 'character-c')).toBe('character-c');
        expect(resolveDirectVideoFirstFrame()).toBeUndefined();
    });
});
