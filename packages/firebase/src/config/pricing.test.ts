import { describe, expect, it } from 'vitest';

import { estimateTranscoderRenderCost } from './pricing';

describe('estimateTranscoderRenderCost', () => {
    it('reserves both video passes when a canonical master is mapped into the final output', () => {
        expect(estimateTranscoderRenderCost({
            width: 1920,
            height: 1080,
            durationSeconds: 60,
            passes: 2,
        })).toBe(0.06);
    });

    it('uses the published UHD output class and rejects an impossible timeline', () => {
        expect(estimateTranscoderRenderCost({
            width: 3840,
            height: 2160,
            durationSeconds: 30,
            passes: 1,
        })).toBe(0.03);
        expect(() => estimateTranscoderRenderCost({
            width: 0,
            height: 1080,
            durationSeconds: 10,
            passes: 1,
        })).toThrow('resolution is invalid');
    });
});
