import { describe, expect, it } from 'vitest';

import { getTotalMilesFromItinerary, itineraryToMileageTrips } from './milesTracking';
import type { Itinerary } from './types';

const itinerary: Itinerary = {
    id: 'itinerary-1',
    userId: 'user-1',
    tourName: 'Test tour',
    totalDistance: '900 miles straight-line',
    stops: [
        { date: '2099-08-09', city: 'Detroit', venue: '', activity: 'Show', notes: '', distance: 12.5 },
        { date: '2099-08-10', city: 'Chicago', venue: '', activity: 'Show', notes: '', distance: 7.5 },
        { date: '2099-08-11', city: 'Milwaukee', venue: '', activity: 'Show', notes: '' },
    ],
};

describe('touring mileage evidence', () => {
    it('totals only explicit recorded leg distances', () => {
        expect(getTotalMilesFromItinerary(itinerary)).toBe(20);
    });

    it('does not parse a route-draft estimate as recorded mileage', () => {
        expect(getTotalMilesFromItinerary({
            ...itinerary,
            stops: itinerary.stops.map(stop => ({ ...stop, distance: undefined })),
        })).toBe(0);
    });

    it('requires an explicit mileage rate and does not assign reimbursement status', () => {
        expect(itineraryToMileageTrips(itinerary, 'user-1', 0.5, 'tour-1')).toEqual([
            expect.objectContaining({ miles: 13, mileageRate: 0.5, reimbursable: false, tourId: 'tour-1' }),
            expect.objectContaining({ miles: 8, mileageRate: 0.5, reimbursable: false, tourId: 'tour-1' }),
        ]);
    });
});
