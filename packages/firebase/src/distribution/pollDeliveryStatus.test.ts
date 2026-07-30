import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: vi.fn(() => vi.fn()) }));
vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(),
    FieldValue: { arrayUnion: vi.fn() },
}));
vi.mock('firebase-functions', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { applyStatusHeuristic, PENDING_STATUSES } from './pollDeliveryStatus';

const hoursAgo = (h: number) => Date.now() - h * 60 * 60 * 1000;

describe('applyStatusHeuristic (ISSUE-1288)', () => {
    it('never promotes a release to the terminal "live" state on a guess', () => {
        // Well past DistroKid's 48h lead time, but no DSP ever confirmed anything.
        const result = applyStatusHeuristic('in_review', 'distrokid', hoursAgo(500));

        expect(result).not.toBe('live');
        expect(result).toBe('likely_live');
    });

    it('promotes to likely_live only after the distributor lead time elapses', () => {
        // TuneCore lead time is 72h.
        expect(applyStatusHeuristic('in_review', 'tunecore', hoursAgo(71))).toBe('in_review');
        expect(applyStatusHeuristic('in_review', 'tunecore', hoursAgo(73))).toBe('likely_live');
    });

    it('respects per-distributor lead times rather than one global timer', () => {
        // At 100h: past tunecore's 72h, still short of cdbaby's 240h.
        expect(applyStatusHeuristic('in_review', 'tunecore', hoursAgo(100))).toBe('likely_live');
        expect(applyStatusHeuristic('in_review', 'cdbaby', hoursAgo(100))).toBe('in_review');
    });

    it('keeps polling likely_live so a real confirmation can still arrive', () => {
        // If this dropped out of the polled set, a guessed release could never be
        // corrected or upgraded to a confirmed 'live'.
        expect(PENDING_STATUSES).toContain('likely_live');
    });

    it('leaves likely_live untouched — only a real API status may move it on', () => {
        expect(applyStatusHeuristic('likely_live', 'distrokid', hoursAgo(9999))).toBe('likely_live');
    });

    it('advances pending to in_review after the initial window', () => {
        expect(applyStatusHeuristic('pending', 'distrokid', hoursAgo(1))).toBe('pending');
        expect(applyStatusHeuristic('pending', 'distrokid', hoursAgo(3))).toBe('in_review');
    });

    it('does not guess at all when the delivery time is unknown', () => {
        expect(applyStatusHeuristic('in_review', 'distrokid', undefined)).toBe('in_review');
    });
});
