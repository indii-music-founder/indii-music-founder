import { describe, it, expect, beforeEach } from 'vitest';
import {
    PRESAVE_FAN_THRESHOLDS,
    hasCelebrated,
    markCelebrated,
    nextUncelebratedThreshold,
    presaveThresholdKey,
} from '@/services/moments/momentLedger';

describe('momentLedger', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('exports expected pre-save fan thresholds', () => {
        expect(PRESAVE_FAN_THRESHOLDS).toEqual([1, 10, 50, 100, 500, 1000]);
    });

    it('tracks celebrations per uid and eventKey', () => {
        expect(hasCelebrated('user-1', 'release:r1')).toBe(false);

        markCelebrated('user-1', 'release:r1');
        expect(hasCelebrated('user-1', 'release:r1')).toBe(true);
        expect(hasCelebrated('user-2', 'release:r1')).toBe(false);
    });

    it('returns the highest crossed uncelebrated threshold and deduplicates once marked', () => {
        const uid = 'artist-1';
        const campaignId = 'camp-1';

        expect(nextUncelebratedThreshold(uid, campaignId, 0)).toBeNull();
        expect(nextUncelebratedThreshold(uid, campaignId, 1)).toBe(1);

        markCelebrated(uid, presaveThresholdKey(campaignId, 1));
        expect(nextUncelebratedThreshold(uid, campaignId, 1)).toBeNull();
        expect(nextUncelebratedThreshold(uid, campaignId, 9)).toBeNull();

        expect(nextUncelebratedThreshold(uid, campaignId, 42)).toBe(10);
        markCelebrated(uid, presaveThresholdKey(campaignId, 10));
        expect(nextUncelebratedThreshold(uid, campaignId, 42)).toBeNull();

        expect(nextUncelebratedThreshold(uid, campaignId, 1200)).toBe(1000);
        markCelebrated(uid, presaveThresholdKey(campaignId, 1000));
        expect(nextUncelebratedThreshold(uid, campaignId, 1200)).toBeNull();
    });

    it('handles missing uid gracefully', () => {
        expect(hasCelebrated(undefined, 'any')).toBe(false);
        expect(nextUncelebratedThreshold(null, 'camp-1', 100)).toBeNull();
        expect(() => markCelebrated('', 'any')).not.toThrow();
    });
});
