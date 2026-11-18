import { describe, expect, it } from 'vitest';
import { countdownParts } from './countdown';

describe('countdownParts', () => {
    it('decomposes YYYY-MM-DD into days, hours, minutes, and seconds from local midnight', () => {
        const now = new Date(2026, 10, 18, 21, 15, 30); // Nov 18 2026, 21:15:30 local
        const result = countdownParts('2026-11-20', now);

        expect(result).toEqual({
            days: 1,
            hours: 2,
            minutes: 44,
            seconds: 30,
            isOut: false,
            accessibleLabel: '1 day, 2 hours, 44 minutes, 30 seconds until release',
        });
    });

    it('supports ISO timestamps with timezone offsets', () => {
        const now = new Date('2026-11-18T12:00:00Z');
        const result = countdownParts('2026-11-18T13:05:09Z', now);

        expect(result).toEqual({
            days: 0,
            hours: 1,
            minutes: 5,
            seconds: 9,
            isOut: false,
            accessibleLabel: '1 hour, 5 minutes, 9 seconds until release',
        });
    });

    it('supports epoch milliseconds', () => {
        const now = new Date(Date.UTC(2026, 10, 18, 0, 0, 0));
        const target = Date.UTC(2026, 10, 21, 4, 30, 15);
        const result = countdownParts(target, now);

        expect(result).toEqual({
            days: 3,
            hours: 4,
            minutes: 30,
            seconds: 15,
            isOut: false,
            accessibleLabel: '3 days, 4 hours, 30 minutes, 15 seconds until release',
        });
    });

    it('marks exact release instant and past dates as out now', () => {
        const target = Date.UTC(2026, 10, 18, 12, 0, 0);
        expect(countdownParts(target, new Date(target))).toEqual({
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            isOut: true,
            accessibleLabel: 'Out now',
        });

        expect(countdownParts('2026-01-01', new Date(2026, 10, 18, 12, 0, 0))).toEqual({
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            isOut: true,
            accessibleLabel: 'Out now',
        });
    });

    it('handles invalid dates and calendar rollovers gracefully without NaN', () => {
        for (const bad of ['not-a-date', '', '2026-02-30', '2026-13-01', Number.NaN, Number.POSITIVE_INFINITY]) {
            const result = countdownParts(bad, new Date(2026, 10, 18));
            expect(result.isOut).toBe(true);
            expect(result.days).toBe(0);
            expect(result.hours).toBe(0);
            expect(result.minutes).toBe(0);
            expect(result.seconds).toBe(0);
            expect(result.accessibleLabel).toBe('Release date unavailable');
        }
    });

    it('computes exact elapsed time across DST transitions without negative units', () => {
        const beforeDst = new Date('2026-11-01T04:30:00Z'); // 00:30 EDT
        const afterDst = '2026-11-01T07:30:00Z'; // 3 physical hours later
        const result = countdownParts(afterDst, beforeDst);

        expect(result).toEqual({
            days: 0,
            hours: 3,
            minutes: 0,
            seconds: 0,
            isOut: false,
            accessibleLabel: '3 hours, 0 minutes, 0 seconds until release',
        });
    });
});
