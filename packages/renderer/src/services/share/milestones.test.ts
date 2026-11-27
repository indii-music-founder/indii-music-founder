import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimMilestone, isMilestoneSoundEnabled, setMilestoneSoundEnabled } from '@/services/share/milestones';

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
        // Spy on the prototype: jsdom's Storage is a named-property object, so an
        // instance-level spy can be stored as an item instead of intercepting calls.
        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        try {
            expect(claimMilestone('first-track-analyzed', 'u1')).toBe(false);
            // Guard against a no-op spy: the blocked path must actually be exercised.
            expect(getItem).toHaveBeenCalled();
        } finally {
            getItem.mockRestore();
            setItem.mockRestore();
        }
    });

    it('never celebrates when the claim cannot be persisted', () => {
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
        try {
            expect(claimMilestone('first-track-analyzed', 'u1')).toBe(false);
            expect(spy).toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
        expect(window.localStorage.getItem('indii:milestone:first-track-analyzed:u1')).toBeNull();
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
