import { describe, expect, it } from 'vitest';
import {
    SHARE_UNITS_PER_PERCENT,
    TOTAL_SHARE_UNITS,
    shareUnitsToPercent,
    splitsResolveExactly,
    sumShareUnits,
    toShareUnits,
} from './shareUnits.js';

describe('shareUnits (fixed-point split arithmetic)', () => {
    it('defines 10,000 basis-point units per percent and 1,000,000 for the whole', () => {
        expect(SHARE_UNITS_PER_PERCENT).toBe(10_000);
        expect(TOTAL_SHARE_UNITS).toBe(1_000_000);
    });

    it('converts percentages exactly at four decimal places', () => {
        expect(toShareUnits(100)).toBe(1_000_000);
        expect(toShareUnits(50)).toBe(500_000);
        expect(toShareUnits(33.3333)).toBe(333_333);
        expect(toShareUnits(0.0001)).toBe(1);
        expect(shareUnitsToPercent(333_333)).toBeCloseTo(33.3333, 6);
    });

    it('fails closed on non-finite percentages', () => {
        expect(Number.isNaN(toShareUnits(Number.NaN))).toBe(true);
        expect(Number.isNaN(toShareUnits(Infinity))).toBe(true);
        expect(Number.isNaN(sumShareUnits([50, Number.NaN, 50]))).toBe(true);
        expect(Number.isNaN(sumShareUnits([50, Infinity, 50]))).toBe(true);
        expect(splitsResolveExactly([50, Number.NaN])).toBe(false);
    });

    it('resolves split sets that hit exactly 100.00% — including classic float traps', () => {
        // The canonical float trap: 0.1 + 0.2 !== 0.3 in raw float math.
        expect(splitsResolveExactly([33.33, 33.33, 33.34])).toBe(true);
        expect(splitsResolveExactly([0.1, 0.2, 99.7])).toBe(true);
        expect(splitsResolveExactly([16.6667, 16.6667, 16.6666, 50.0])).toBe(true);
        expect(splitsResolveExactly([100])).toBe(true);
        expect(splitsResolveExactly([50, 25, 12.5, 12.5])).toBe(true);
        expect(splitsResolveExactly([])).toBe(false);
    });

    it('rejects sums that only look like 100 under a tolerance band', () => {
        // 99.999999% would pass |sum - 100| <= 0.01 tolerance gates; it must not pass here.
        expect(splitsResolveExactly([33.333333, 33.333333, 33.333334])).toBe(false);
        expect(splitsResolveExactly([50, 49.9999])).toBe(false);
        expect(splitsResolveExactly([99.995])).toBe(false);
        expect(splitsResolveExactly([100.004])).toBe(false);
    });

    it('sums share units exactly', () => {
        expect(sumShareUnits([25, 25, 25, 25])).toBe(TOTAL_SHARE_UNITS);
        expect(sumShareUnits([33.3333, 33.3333, 33.3334])).toBe(TOTAL_SHARE_UNITS);
        expect(sumShareUnits([60, 60])).toBe(1_200_000);
    });

    it('rounds each entry before summing (banker-free half-up rounding)', () => {
        // 33.33335*3 rounds to 333334 (half-up) each -> 1000002, NOT the whole.
        expect(sumShareUnits([33.33335, 33.33335, 33.33335])).toBe(1_000_002);
    });
});
