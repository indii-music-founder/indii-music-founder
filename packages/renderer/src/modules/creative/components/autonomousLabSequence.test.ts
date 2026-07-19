import { describe, expect, it } from 'vitest';
import { getValidatedSequenceDurations } from './autonomousLabSequence';

describe('getValidatedSequenceDurations', () => {
    it('rejects an empty sequence', () => {
        expect(getValidatedSequenceDurations([], 120)).toBeNull();
    });

    it('converts seconds and beats using the selected BPM', () => {
        expect(getValidatedSequenceDurations([
            { type: 'seconds', value: 6 },
            { type: 'beats', value: 8 },
        ], 120)).toEqual([6, 4]);
    });

    it.each([
        { type: 'seconds' as const, value: 0 },
        { type: 'seconds' as const, value: -1 },
        { type: 'seconds' as const, value: Number.NaN },
        { type: 'beats' as const, value: Number.POSITIVE_INFINITY },
    ])('rejects invalid segment values', (item) => {
        expect(getValidatedSequenceDurations([item], 120)).toBeNull();
    });

    it('rejects invalid BPM and totals over 60 seconds', () => {
        expect(getValidatedSequenceDurations([{ type: 'beats', value: 4 }], 0)).toBeNull();
        expect(getValidatedSequenceDurations([
            { type: 'seconds', value: 40 },
            { type: 'seconds', value: 21 },
        ], 120)).toBeNull();
    });

    it('accepts the 60-second boundary', () => {
        expect(getValidatedSequenceDurations([
            { type: 'seconds', value: 60 },
        ], 120)).toEqual([60]);
    });
});
