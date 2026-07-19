import { describe, expect, it } from 'vitest';
import { getStoryboardTimingError, isValidStoryboardSceneDuration } from './screenwriterTiming';

describe('screenwriter timing validation', () => {
    it.each([1, 8, 60])('accepts valid whole-second scene duration %s', (duration) => {
        expect(isValidStoryboardSceneDuration(duration)).toBe(true);
    });

    it.each([0, -1, 1.5, 61, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid scene duration %s', (duration) => {
        expect(isValidStoryboardSceneDuration(duration)).toBe(false);
    });

    it('rejects empty, invalid, and over-budget storyboards', () => {
        expect(getStoryboardTimingError([])).toMatch(/at least one/);
        expect(getStoryboardTimingError([5, 0])).toMatch(/Scene 2/);
        expect(getStoryboardTimingError(Array.from({ length: 11 }, () => 60))).toMatch(/600 seconds/);
        expect(getStoryboardTimingError([5, 8, 7])).toBeNull();
    });
});
