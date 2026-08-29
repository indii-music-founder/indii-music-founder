import { describe, it, expect } from 'vitest';
import {
    moveTransform,
    MOTION_PRESETS,
    MOTION_PRESET_IDS,
    cubicInOut,
    OVERSCAN_BASE,
    MAX_DOLLY_RANGE,
    CINEMATIC_MOVE_PROMPTS,
    genMotionEnabled,
    GEN_MOTION_FLAG,
    type CameraMoveKind
} from '../MotionPresets';

const KINDS: CameraMoveKind[] = [
    'dolly-in', 'dolly-out', 'pan-left',
    'pan-right', 'tilt-up', 'tilt-down', 'ken-burns'
];

const FRAME = { w: 1080, h: 1920 };

describe('moveTransform anchors (E1.1)', () => {
    it('progress 0 and 1 land on exact anchors for every preset', () => {
        for (const id of MOTION_PRESET_IDS) {
            const move = MOTION_PRESETS[id]!;
            const start = moveTransform(move, 0, FRAME.w, FRAME.h);
            const end = moveTransform(move, 1, FRAME.w, FRAME.h);

            if (move.kind !== 'dolly-out') expect(start.scale).toBe(OVERSCAN_BASE);
            expect(start.translateX).toBeCloseTo(0, 6);
            expect(start.translateY).toBeCloseTo(0, 6);

            // Full-intensity anchor is deterministic per kind.
            if (move.kind === 'dolly-in') {
                expect(end.scale).toBeCloseTo(OVERSCAN_BASE + MAX_DOLLY_RANGE * move.intensity, 4);
            }
            if (move.kind === 'dolly-out') {
                expect(start.scale).toBeCloseTo(OVERSCAN_BASE + MAX_DOLLY_RANGE * move.intensity, 4);
                expect(end.scale).toBe(OVERSCAN_BASE); // eased fully back
            }
        }
    });

    it('dolly scale is monotonically non-decreasing across progress (in) and non-increasing (out)', () => {
        const samples = Array.from({ length: 101 }, (_, i) => i / 100);
        for (const [kind, direction] of [['dolly-in', 1], ['dolly-out', -1]] as const) {
            let prev = direction === 1 ? 0 : Infinity;
            for (const p of samples) {
                const { scale } = moveTransform(MOTION_PRESETS[kind]!, p, FRAME.w, FRAME.h);
                if (direction === 1) expect(scale).toBeGreaterThanOrEqual(prev - 1e-9);
                else expect(scale).toBeLessThanOrEqual(prev + 1e-9);
                prev = scale;
            }
        }
    });

    it('never exceeds the overscan envelope for any preset × intensity × progress', () => {
        for (const kind of KINDS) {
            for (const intensity of [0, 0.2, 0.35, 0.7, 1]) {
                const move = { kind, intensity, durationSec: 4 };
                for (let i = 0; i <= 100; i++) {
                    const t = moveTransform(move, i / 100, FRAME.w, FRAME.h);
                    expect(t.scale).toBeGreaterThanOrEqual(OVERSCAN_BASE - 1e-9);
                    const envX = (FRAME.w * (t.scale - 1)) / 2;
                    const envY = (FRAME.h * (t.scale - 1)) / 2;
                    expect(Math.abs(t.translateX)).toBeLessThanOrEqual(envX + 1e-6);
                    expect(Math.abs(t.translateY)).toBeLessThanOrEqual(envY + 1e-6);
                }
            }
        }
    });

    it('easing is cubic in-out: slow start, slow settle', () => {
        expect(cubicInOut(0)).toBe(0);
        expect(cubicInOut(1)).toBe(1);
        expect(cubicInOut(0.5)).toBeCloseTo(0.5, 10);
        expect(cubicInOut(0.25)).toBeLessThan(0.25); // ease-in half
        expect(cubicInOut(0.75)).toBeGreaterThan(0.75); // ease-out half
    });

    it('rejects bad frames and unknown kinds', () => {
        expect(() => moveTransform(MOTION_PRESETS['dolly-in']!, 0.5, 0, 100)).toThrow();
        expect(() => moveTransform({ kind: 'zoom-zoom' as never, intensity: 0.5, durationSec: 4 }, 0.5, 100, 100)).toThrow();
    });
});

describe('preset snapshot (E1.2)', () => {
    it('all seven presets serialize stable', () => {
        expect(MOTION_PRESET_IDS).toHaveLength(7);
        expect(JSON.stringify(MOTION_PRESETS)).toBe(JSON.stringify({
            'dolly-in': { kind: 'dolly-in', intensity: 0.35, durationSec: 4 },
            'dolly-out': { kind: 'dolly-out', intensity: 0.35, durationSec: 4 },
            'pan-left': { kind: 'pan-left', intensity: 0.35, durationSec: 4 },
            'pan-right': { kind: 'pan-right', intensity: 0.35, durationSec: 4 },
            'tilt-up': { kind: 'tilt-up', intensity: 0.35, durationSec: 4 },
            'tilt-down': { kind: 'tilt-down', intensity: 0.35, durationSec: 4 },
            'ken-burns': { kind: 'ken-burns', intensity: 0.35, durationSec: 4 }
        }));
    });
});

describe('E2 scaffolds (E2.1 — flag-gated off by default)', () => {
    it('every scaffold carries the no-scene-change clause', () => {
        for (const [kind, prompt] of Object.entries(CINEMATIC_MOVE_PROMPTS)) {
            expect(prompt, kind).toContain('no scene change');
            expect(prompt, kind).toContain('4 seconds');
        }
    });

    it('gen motion is disabled unless the flag is explicitly on', () => {
        expect(genMotionEnabled({})).toBe(false);
        expect(genMotionEnabled({ [GEN_MOTION_FLAG]: 'false' })).toBe(false);
        expect(genMotionEnabled({ [GEN_MOTION_FLAG]: 'true' })).toBe(true);
        expect(genMotionEnabled({ [GEN_MOTION_FLAG]: '1' })).toBe(true);
    });
});
