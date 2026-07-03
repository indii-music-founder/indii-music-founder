import { describe, expect, it } from 'vitest';
import { normalizeVideoAspectRatio } from './videoAspectRatio';

describe('normalizeVideoAspectRatio', () => {
    it('prefers 9:16 for square and portrait sources', () => {
        expect(normalizeVideoAspectRatio('1:1').aspectRatio).toBe('9:16');
        expect(normalizeVideoAspectRatio('4:5').aspectRatio).toBe('9:16');
    });

    it('prefers 16:9 for landscape sources', () => {
        expect(normalizeVideoAspectRatio('2:1').aspectRatio).toBe('16:9');
    });

    it('preserves exact supported ratios', () => {
        expect(normalizeVideoAspectRatio('9:16')).toEqual({ aspectRatio: '9:16' });
        expect(normalizeVideoAspectRatio('16:9')).toEqual({ aspectRatio: '16:9' });
    });
});
