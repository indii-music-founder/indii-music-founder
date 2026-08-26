import { describe, expect, it } from 'vitest';

import {
    computeMoveUpdate,
    computeTrimUpdate,
    snapFrame,
    type ClipDragContext,
} from './useTimelineDrag';

const ctx = (overrides: Partial<ClipDragContext>): ClipDragContext => ({
    origin: { startFrame: 30, durationInFrames: 60 },
    deltaFrames: 0,
    candidates: [],
    fps: 30,
    ...overrides,
});

describe('timeline snapping', () => {
    it('snaps a frame to the nearest candidate within the threshold', () => {
        expect(snapFrame(29, [30])).toBe(30);
        expect(snapFrame(31, [30])).toBe(30);
        expect(snapFrame(26, [30])).toBe(26); // outside 6px (3 frames)
        expect(snapFrame(0, [0])).toBe(0);
    });

    it('snaps a move to the playhead over free positioning', () => {
        const update = computeMoveUpdate(ctx({
            deltaFrames: 11,
            candidates: [0, 120, 41],
        }));
        expect(update.startFrame).toBe(41); // 30 + 11 = 41 — on the playhead
    });

    it('clamps a move at zero and snaps the start edge to a neighbor end', () => {
        const update = computeMoveUpdate(ctx({
            origin: { startFrame: 4, durationInFrames: 60 },
            deltaFrames: -5,
            candidates: [0, 120],
        }));
        expect(update.startFrame).toBe(0);
    });

    it('trims the right edge and moves the source out-point with the visual edge', () => {
        const update = computeTrimUpdate(ctx({
            origin: { startFrame: 30, durationInFrames: 60, sourceInUs: 500_000, sourceOutUs: 2_500_000 },
            deltaFrames: -10,
            candidates: [0, 120],
        }), 'resize-right');

        expect(update.durationInFrames).toBe(50);
        expect(update.sourceOutUs).toBe(500_000 + 50 * 1_000_000 / 30);
        expect(update.startFrame).toBeUndefined();
    });

    it('trims the left edge and shifts the source in-point, clamped to zero', () => {
        const update = computeTrimUpdate(ctx({
            origin: { startFrame: 30, durationInFrames: 60, sourceInUs: 1_000_000, sourceOutUs: 3_000_000 },
            deltaFrames: 12,
            candidates: [0, 120],
        }), 'resize-left');

        expect(update.startFrame).toBe(42);
        expect(update.durationInFrames).toBe(48);
        expect(update.sourceInUs).toBe(1_000_000 + 12 * 1_000_000 / 30);

        const clamped = computeTrimUpdate(ctx({
            origin: { startFrame: 10, durationInFrames: 60, sourceInUs: 200_000, sourceOutUs: 3_000_000 },
            deltaFrames: -40,
            candidates: [0, 120],
        }), 'resize-left');
        expect(clamped.startFrame).toBe(0);
        expect(clamped.durationInFrames).toBe(70);
        expect(clamped.sourceInUs).toBeCloseTo(200_000 - 10 * 1_000_000 / 30, 6);
    });

    it('snaps a right-edge trim to the playhead', () => {
        const update = computeTrimUpdate(ctx({
            deltaFrames: 9,
            candidates: [0, 120, 99],
        }), 'resize-right');
        expect(update.durationInFrames).toBe(69); // end 90 + 9 = 99 — playhead
    });
});
