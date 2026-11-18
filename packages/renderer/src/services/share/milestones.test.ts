import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimMilestone, isMilestoneSoundEnabled, setMilestoneSoundEnabled } from './milestones';

describe('claimMilestone', () => {
    afterEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('returns true exactly once per milestone and user', () => {
        expect(claimMilestone('first-track-analyzed', 'u1')).toBe(true);
        expect(claimMilestone('first-track-analyzed', 'u1')).toBe(false);
        expect(claimMilestone('first-track-analyzed', 'u2')).toBe(true);
        expect(claimMilestone('first-release-delivered', 'u1')).toBe(true);
        expect(window.localStorage.getItem('indii:milestone:first-track-analyzed:u1')).toBeTruthy();
    });

    it('never celebrates when storage is unavailable', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(claimMilestone('first-track-analyzed', 'u1')).toBe(false);
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
