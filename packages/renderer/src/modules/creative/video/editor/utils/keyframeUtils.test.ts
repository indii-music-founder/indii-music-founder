import { describe, it, expect } from 'vitest';
import { getKeyframeColor, easeValue, interpolateKeyframeValue } from './keyframeUtils';
import type { IndiiVideoKeyframe } from '@indii/shared';

describe('keyframeUtils', () => {
    describe('getKeyframeColor', () => {
        it('returns proper Tailwind color classes for each easing', () => {
            expect(getKeyframeColor('easeIn')).toBe('bg-blue-400');
            expect(getKeyframeColor('easeOut')).toBe('bg-green-400');
            expect(getKeyframeColor('easeInOut')).toBe('bg-purple-400');
            expect(getKeyframeColor('linear')).toBe('bg-yellow-400');
            expect(getKeyframeColor(undefined)).toBe('bg-yellow-400');
            expect(getKeyframeColor('custom-unknown-curve')).toBe('bg-yellow-400');
        });

        it('assigns mutually distinct colors across all four standard easing types', () => {
            const easeColors = [
                getKeyframeColor('linear'),
                getKeyframeColor('easeIn'),
                getKeyframeColor('easeOut'),
                getKeyframeColor('easeInOut'),
            ];
            const unique = new Set(easeColors);
            expect(unique.size).toBe(4);
            expect(getKeyframeColor('easeInOut')).not.toBe(getKeyframeColor('easeOut'));
        });
    });

    describe('easeValue', () => {
        it('calculates linear progress correctly', () => {
            expect(easeValue(0.5, 'linear')).toBe(0.5);
            expect(easeValue(0, 'linear')).toBe(0);
            expect(easeValue(1, 'linear')).toBe(1);
        });

        it('clamps inputs to [0, 1]', () => {
            expect(easeValue(-0.5, 'linear')).toBe(0);
            expect(easeValue(1.5, 'linear')).toBe(1);
        });

        it('evaluates easeIn, easeOut, easeInOut curves', () => {
            expect(easeValue(0.5, 'easeIn')).toBe(0.25);
            expect(easeValue(0.5, 'easeOut')).toBe(0.75);
            expect(easeValue(0.5, 'easeInOut')).toBe(0.5);
        });
    });

    describe('interpolateKeyframeValue', () => {
        const volumeKeys: IndiiVideoKeyframe[] = [
            { frame: 10, value: 0.2, easing: 'linear' },
            { frame: 30, value: 0.8, easing: 'linear' },
        ];

        it('returns defaultValue when keyframes are empty or undefined', () => {
            expect(interpolateKeyframeValue(undefined, 15, 1)).toBe(1);
            expect(interpolateKeyframeValue([], 15, 1)).toBe(1);
        });

        it('clamps to first keyframe when before first frame', () => {
            expect(interpolateKeyframeValue(volumeKeys, 0)).toBe(0.2);
            expect(interpolateKeyframeValue(volumeKeys, 10)).toBe(0.2);
        });

        it('clamps to last keyframe when after last frame', () => {
            expect(interpolateKeyframeValue(volumeKeys, 40)).toBe(0.8);
            expect(interpolateKeyframeValue(volumeKeys, 30)).toBe(0.8);
        });

        it('interpolates linearly midway between keyframes', () => {
            // Midway between frame 10 (0.2) and frame 30 (0.8) is frame 20 -> 0.5
            expect(interpolateKeyframeValue(volumeKeys, 20)).toBeCloseTo(0.5);
        });
    });
});
