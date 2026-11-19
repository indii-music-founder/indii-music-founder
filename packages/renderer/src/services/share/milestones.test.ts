import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimMilestone, isMilestoneSoundEnabled, setMilestoneSoundEnabled } from './milestones';

describe('claimMilestone', () => {
    afterEach(() => {
        window.localStorage.clear();
    });

    it('returns true exactly once per milestone and user', () => {
        expect(claimMilestone('first-track-analyzed', 'u1')).toBe(true);
        expect(claimMilestone('first-track-analyzed', 'u1')).toBe(false);
        expect(claimMilestone('first-track-analyzed', 'u2')).toBe(true);
        expect(claimMilestone('first-release-delivered', 'u1')).toBe(true);
        expect(window.localStorage.getItem('indii:milestone:first-track-analyzed:u1')).toBeTruthy();
    });

    it('never celebrates when storage is unavailable', () => {
        const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => { throw new Error('blocked'); });
        try {
            expect(claimMilestone('first-track-analyzed', 'u1')).toBe(false);
        } finally {
            spy.mockRestore();
        }
    });
});

describe('milestone sound preference', () => {
    afterEach(() => window.localStorage.clear());

    it('is off by default and remembers the choice', () => {
        expect(isMilestoneSoundEnabled()).toBe(false);
        setMilestoneSoundEnabled(true);
        expect(isMilestoneSoundEnabled()).toBe(true);
        setMilestoneSoundEnabled(false);
        expect(isMilestoneSoundEnabled()).toBe(false);
    });
});
