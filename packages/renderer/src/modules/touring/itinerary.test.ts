import { describe, expect, it } from 'vitest';
import { findNextItineraryStop, formatTouringDate, parseTouringDate, toTouringDateOnly } from './itinerary';

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

    it('formats date-only values from the local calendar date', () => {
        expect(toTouringDateOnly(new Date(2026, 7, 9, 23, 30))).toBe('2026-08-09');
    });

    it('selects the earliest upcoming stop without skipping today', () => {
        const itinerary = {
            id: 'itinerary-1',
            userId: 'user-1',
            tourName: 'Test tour',
            totalDistance: 'Not calculated',
            stops: [
                { date: '2026-08-12', city: 'Chicago', venue: '', activity: 'Show', notes: '' },
                { date: '2026-08-09', city: 'Detroit', venue: '', activity: 'Show', notes: '' },
                { date: '2026-08-08', city: 'Cleveland', venue: '', activity: 'Show', notes: '' },
            ],
        };

        expect(findNextItineraryStop(itinerary, new Date(2026, 7, 9, 23, 59))?.city).toBe('Detroit');
    });

    it('does not present an expired stop as the next destination', () => {
        const itinerary = {
            id: 'itinerary-1',
            userId: 'user-1',
            tourName: 'Test tour',
            totalDistance: 'Not calculated',
            stops: [
                { date: '2026-08-08', city: 'Cleveland', venue: '', activity: 'Show', notes: '' },
            ],
        };

        expect(findNextItineraryStop(itinerary, new Date(2026, 7, 9))).toBeUndefined();
    });
});
