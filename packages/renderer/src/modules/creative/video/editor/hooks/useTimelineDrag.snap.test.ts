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
    pxPerFrame: 2,
    ...overrides,
});

describe('timeline snapping', () => {
    describe('snapFrame', () => {
        it('snaps a frame to the nearest candidate within the threshold and returns snap metadata', () => {
            const snap1 = snapFrame(29, [30], 2);
            expect(snap1.snappedFrame).toBe(30);
            expect(snap1.didSnap).toBe(true);
            expect(snap1.snapTarget).toBe(30);
            expect(snap1.distancePx).toBe(2);

            const snap2 = snapFrame(31, [30], 2);
            expect(snap2.snappedFrame).toBe(30);
            expect(snap2.didSnap).toBe(true);
            expect(snap2.snapTarget).toBe(30);
            expect(snap2.distancePx).toBe(2);

            // Outside 6px threshold (3 frames at 2px/frame)
            const snapOutside = snapFrame(26, [30], 2);
            expect(snapOutside.snappedFrame).toBe(26);
            expect(snapOutside.didSnap).toBe(false);
            expect(snapOutside.snapTarget).toBeUndefined();

            const snapExact = snapFrame(0, [0], 2);
            expect(snapExact.snappedFrame).toBe(0);
            expect(snapExact.didSnap).toBe(true);
            expect(snapExact.snapTarget).toBe(0);
            expect(snapExact.distancePx).toBe(0);
        });

        it('scales the snap threshold with zoom', () => {
            // 2× zoom → 4px per frame → 6px threshold = 1.5 frames
            const snapClose = snapFrame(1.4, [0], 4);
            expect(snapClose.snappedFrame).toBe(0);
            expect(snapClose.didSnap).toBe(true);
            expect(snapClose.distancePx).toBeCloseTo(5.6, 2);

            const snapFar = snapFrame(2.2, [0], 4);
            expect(snapFar.snappedFrame).toBe(2.2);
            expect(snapFar.didSnap).toBe(false);
        });
    });

    describe('dual-edge magnetic snapping during move (Feature 15)', () => {
        it('snaps leading edge to candidate when leading edge is closest', () => {
            const update = computeMoveUpdate(ctx({
                deltaFrames: 11,
                candidates: [0, 120, 41],
            }));
            // 30 + 11 = 41 (leading edge snaps to 41)
            expect(update.startFrame).toBe(41);
            expect(update.snapIndicatorFrame).toBe(41);
        });

        it('snaps trailing edge to candidate when trailing edge is closest', () => {
            // Clip origin: startFrame 30, duration 60 -> endFrame is 90
            // Drag deltaFrames: 59 -> rawStart = 89, rawEnd = 149
            // Candidate: 150 (distance 1 frame to trailing edge vs 61 frames to leading edge)
            const update = computeMoveUpdate(ctx({
                origin: { startFrame: 30, durationInFrames: 60 },
                deltaFrames: 59,
                candidates: [0, 150, 300],
            }));
            // Trailing edge snaps to 150 -> startFrame = 150 - 60 = 90
            expect(update.startFrame).toBe(90);
            expect(update.snapIndicatorFrame).toBe(150);
        });

        it('chooses the closest edge when both leading and trailing edges are within threshold', () => {
            // Clip: startFrame 20, duration 50 -> endFrame 70
            // Delta: +10 -> rawStart = 30, rawEnd = 80
            // Candidates: 31 (distance to leading = 1 frame = 2px), 80.2 (distance to trailing = 0.2 frame = 0.4px)
            const update = computeMoveUpdate(ctx({
                origin: { startFrame: 20, durationInFrames: 50 },
                deltaFrames: 10,
                candidates: [31, 80.2],
                pxPerFrame: 2,
            }));
            // Trailing edge is closer (0.4px < 2px) -> aligns to 80.2 -> startFrame = 80.2 - 50 = 30.2
            expect(update.startFrame).toBeCloseTo(30.2, 2);
            expect(update.snapIndicatorFrame).toBe(80.2);
        });

        it('returns raw position and null snap indicator when neither edge snaps', () => {
            const update = computeMoveUpdate(ctx({
                origin: { startFrame: 30, durationInFrames: 60 },
                deltaFrames: 15,
                candidates: [0, 200],
            }));
            expect(update.startFrame).toBe(45);
            expect(update.snapIndicatorFrame).toBeNull();
        });

        it('clamps a move at zero and snaps start edge to zero', () => {
            const update = computeMoveUpdate(ctx({
                origin: { startFrame: 4, durationInFrames: 60 },
                deltaFrames: -5,
                candidates: [0, 120],
            }));
            expect(update.startFrame).toBe(0);
            expect(update.snapIndicatorFrame).toBe(0);
        });
    });

    describe('boundary protection and trimming (Feature 17)', () => {
        it('trims right edge and updates sourceOutUs within media bounds', () => {
            const update = computeTrimUpdate(ctx({
                origin: { startFrame: 30, durationInFrames: 60, sourceInUs: 500_000, sourceOutUs: 2_500_000 },
                deltaFrames: -10,
                candidates: [0, 120],
            }), 'resize-right');

            expect(update.durationInFrames).toBe(50);
            expect(update.sourceOutUs).toBe(500_000 + 50 * 1_000_000 / 30);
            expect(update.startFrame).toBeUndefined();
            expect(update.snapIndicatorFrame).toBeNull();
        });

        it('enforces durationInFrames >= 1 when trimming right edge past start frame', () => {
            const update = computeTrimUpdate(ctx({
                origin: { startFrame: 30, durationInFrames: 60, sourceInUs: 500_000, sourceOutUs: 2_500_000 },
                deltaFrames: -100, // Dragged far left past origin.startFrame
                candidates: [0, 10, 20, 30], // Even if snapped to a candidate at or before startFrame
            }), 'resize-right');

            expect(update.durationInFrames).toBeGreaterThanOrEqual(1);
            expect(update.durationInFrames).toBe(1);
            expect(update.sourceOutUs).toBeGreaterThan(500_000);
        });

        it('snaps a right-edge trim to the playhead and illuminates snap indicator', () => {
            const update = computeTrimUpdate(ctx({
                deltaFrames: 9,
                candidates: [0, 120, 99],
            }), 'resize-right');
            expect(update.durationInFrames).toBe(69); // 30 + 69 = 99
            expect(update.snapIndicatorFrame).toBe(99);
        });

        it('trims left edge and clamps sourceInUs to 0 (never negative)', () => {
            const update = computeTrimUpdate(ctx({
                origin: { startFrame: 30, durationInFrames: 60, sourceInUs: 1_000_000, sourceOutUs: 3_000_000 },
                deltaFrames: 12,
                candidates: [0, 120],
            }), 'resize-left');

            expect(update.startFrame).toBe(42);
            expect(update.durationInFrames).toBe(48);
            expect(update.sourceInUs).toBe(1_000_000 + 12 * 1_000_000 / 30);

            // Left trim dragged left past frame 0
            const clamped = computeTrimUpdate(ctx({
                origin: { startFrame: 10, durationInFrames: 60, sourceInUs: 200_000, sourceOutUs: 3_000_000 },
                deltaFrames: -40,
                candidates: [0, 120],
            }), 'resize-left');
            expect(clamped.startFrame).toBe(0);
            expect(clamped.durationInFrames).toBe(70);
            expect(clamped.sourceInUs).toBe(0); // Clamped at 0, never negative!
        });

        it('enforces durationInFrames >= 1 when trimming left edge rightward to end frame', () => {
            const update = computeTrimUpdate(ctx({
                origin: { startFrame: 10, durationInFrames: 60, sourceInUs: 200_000, sourceOutUs: 3_000_000 },
                deltaFrames: 100, // Dragged past endFrame (70)
                candidates: [70, 80],
            }), 'resize-left');

            expect(update.durationInFrames).toBeGreaterThanOrEqual(1);
            expect(update.durationInFrames).toBe(1);
            expect(update.startFrame).toBe(69);
            expect(update.sourceInUs).toBeLessThan(3_000_000);
        });

        it('snaps a left-edge trim to candidate and illuminates snap indicator', () => {
            const update = computeTrimUpdate(ctx({
                origin: { startFrame: 30, durationInFrames: 60 },
                deltaFrames: -14, // 30 - 14 = 16
                candidates: [15, 100], // 15 is within 2px threshold
            }), 'resize-left');

            expect(update.startFrame).toBe(15);
            expect(update.durationInFrames).toBe(75); // end 90 - 15 = 75
            expect(update.snapIndicatorFrame).toBe(15);
        });
    });
});
