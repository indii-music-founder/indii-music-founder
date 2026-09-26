import { describe, expect, it } from 'vitest';

import { compileRouteDraft, reviewSchedule, normalizeDistanceMatrix } from './touring';

describe('touring route draft contract', () => {
    it('preserves waypoint order and assigns only deterministic draft dates', () => {
        const draft = compileRouteDraft({
            locations: ['Detroit, MI', 'Chicago, IL', 'Minneapolis, MN'],
            dates: { start: '2026-09-01', end: '2026-09-05' },
        });

        expect(draft.stops).toEqual([
            expect.objectContaining({ city: 'Detroit, MI', date: '2026-09-01', venue: '', type: 'Planning' }),
            expect.objectContaining({ city: 'Chicago, IL', date: '2026-09-03', venue: '', type: 'Planning' }),
            expect.objectContaining({ city: 'Minneapolis, MN', date: '2026-09-05', venue: '', type: 'Planning' }),
        ]);
        expect(draft.status).toBe('route_draft');
        expect(draft.authority).toBe('user_inputs_only');
        expect(draft).not.toHaveProperty('totalDistanceMiles');
        expect(draft).not.toHaveProperty('estimatedBudget');
    });

    it('rejects invalid and reverse date ranges', () => {
        expect(() => compileRouteDraft({
            locations: ['Detroit'],
            dates: { start: '2026-02-30', end: '2026-03-01' },
        })).toThrow();
        expect(() => compileRouteDraft({
            locations: ['Detroit'],
            dates: { start: '2026-09-02', end: '2026-09-01' },
        })).toThrow(/End date must be on or after start date/);
    });
});

describe('touring schedule-only review contract', () => {
    it('finds only date-order and same-day multi-city conflicts', () => {
        const review = reviewSchedule({ itinerary: { stops: [
            { city: 'Detroit', date: '2026-09-02' },
            { city: 'Chicago', date: '2026-09-01' },
            { city: 'Milwaukee', date: '2026-09-01' },
        ] } });

        expect(review.scope).toBe('schedule_only');
        expect(review.hasConflicts).toBe(true);
        expect(review.issues).toEqual([
            'Stop 2 (Chicago) is dated before stop 1 (Detroit).',
            '2026-09-01 contains stops in multiple cities: Chicago, Milwaukee.',
        ]);
        expect(review.limitations[1]).toMatch(/operational feasibility are not verified/);
        expect(review).not.toHaveProperty('isFeasible');
    });

    it('does not turn a clean schedule result into a feasibility verdict', () => {
        const review = reviewSchedule({ itinerary: { stops: [
            { city: 'Detroit', date: '2026-09-01' },
            { city: 'Chicago', date: '2026-09-02' },
        ] } });

        expect(review.hasConflicts).toBe(false);
        expect(review.summary).toContain('within the limited check scope');
        expect(review.limitations[1]).toMatch(/operational feasibility are not verified/);
    });
});

describe('distance matrix normalization contract', () => {
    it('maps Google-reported distances and durations without inventing values', () => {
        const result = normalizeDistanceMatrix({
            status: 'OK',
            rows: [
                {
                    elements: [
                        {
                            status: 'OK',
                            distance: { text: '283.7 mi', value: 456604 },
                            duration: { text: '4 hours 22 mins', value: 15720 },
                        },
                    ],
                },
            ],
        });

        expect(result.scope).toBe('distance_matrix');
        expect(result.rows).toEqual([[
            {
                status: 'OK',
                distanceMiles: 283.7,
                distanceText: '283.7 mi',
                durationMinutes: 262,
                durationText: '4 hours 22 mins',
            },
        ]]);
        expect(result.limitations.length).toBeGreaterThan(0);
    });

    it('passes unresolvable element statuses through instead of faking a distance', () => {
        const result = normalizeDistanceMatrix({
            rows: [{ elements: [{ status: 'NOT_FOUND' }, { status: 'ZERO_RESULTS' }] }],
        });

        expect(result.rows[0]).toEqual([{ status: 'NOT_FOUND' }, { status: 'ZERO_RESULTS' }]);
    });

    it('tolerates a missing or malformed payload without throwing', () => {
        expect(normalizeDistanceMatrix(undefined).rows).toEqual([]);
        expect(normalizeDistanceMatrix({}).rows).toEqual([]);
        expect(normalizeDistanceMatrix({ rows: [{}] }).rows).toEqual([[]]);
    });
});
