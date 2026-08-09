import { describe, expect, it } from 'vitest';
import { formatTouringDate, parseTouringDate } from './itinerary';

describe('touring date helpers', () => {
    it('treats a date-only itinerary value as a local calendar date', () => {
        const date = parseTouringDate('2026-08-20');

        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth()).toBe(7);
        expect(date.getDate()).toBe(20);
        expect(formatTouringDate('2026-08-20')).toBe('8/20/2026');
    });

    it('preserves an invalid value instead of displaying Invalid Date', () => {
        expect(formatTouringDate('date pending')).toBe('date pending');
    });
});
