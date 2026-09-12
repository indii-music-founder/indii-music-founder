import { describe, expect, it } from 'vitest';
import { nearestTrackIdByY } from './timelineUtils';

const tracks = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];

/** Fixed vertical layout: t1 spans 0-100, t2 spans 108-208, t3 spans 216-316. */
const getRect = (id: string): { top: number; bottom: number } | null => {
    switch (id) {
        case 't1': return { top: 0, bottom: 100 };
        case 't2': return { top: 108, bottom: 208 };
        case 't3': return { top: 216, bottom: 316 };
        default: return null;
    }
};

describe('nearestTrackIdByY', () => {
    it('returns null with no tracks', () => {
        expect(nearestTrackIdByY([], 50, getRect)).toBeNull();
    });

    it('picks the track containing the pointer (distance 0 wins)', () => {
        expect(nearestTrackIdByY(tracks, 150, getRect)).toBe('t2');
        expect(nearestTrackIdByY(tracks, 20, getRect)).toBe('t1');
        expect(nearestTrackIdByY(tracks, 300, getRect)).toBe('t3');
    });

    it('clamps to the first track above the span and the last below it', () => {
        expect(nearestTrackIdByY(tracks, -40, getRect)).toBe('t1');
        expect(nearestTrackIdByY(tracks, 999, getRect)).toBe('t3');
    });

    it('resolves gap drops to the nearer adjacent track', () => {
        // Gap between t1 (ends 100) and t2 (starts 108): y=102 is 2px from t1, 6px from t2.
        expect(nearestTrackIdByY(tracks, 102, getRect)).toBe('t1');
        expect(nearestTrackIdByY(tracks, 106, getRect)).toBe('t2');
    });

    it('falls back to the first track when no rects are measurable (jsdom)', () => {
        expect(nearestTrackIdByY(tracks, 150, () => null)).toBe('t1');
    });
});
