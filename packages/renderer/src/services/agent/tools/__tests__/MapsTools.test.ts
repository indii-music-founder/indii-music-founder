import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapsTools } from '../MapsTools';

const mocks = vi.hoisted(() => ({
    currentUser: null as { uid: string } | null,
    findPlaces: vi.fn(),
    computeDistanceMatrix: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    auth: { get currentUser() { return mocks.currentUser; } },
    functions: {},
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: (_functionsInstance: unknown, name: string) => {
        if (name === 'findPlaces') return mocks.findPlaces;
        if (name === 'computeDistanceMatrix') return mocks.computeDistanceMatrix;
        throw new Error(`Unexpected callable: ${name}`);
    },
}));

describe('MapsTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.currentUser = { uid: 'test-user' };
    });

    describe('search_places', () => {
        it('fails closed with AUTH_REQUIRED when unauthenticated', async () => {
            mocks.currentUser = null;

            const result = await MapsTools.search_places({ query: 'pizza' });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('AUTH_REQUIRED');
            expect(mocks.findPlaces).not.toHaveBeenCalled();
        });

        it('returns live places from the secured findPlaces proxy', async () => {
            mocks.findPlaces.mockResolvedValue({
                data: {
                    places: [
                        {
                            name: 'The Shelter',
                            vicinity: '431 E Congress St, Detroit',
                            rating: 4.5,
                            isOpen: true,
                            place_id: 'place-1',
                            geometry: { location: { lat: 42.331, lng: -83.045 } },
                        },
                    ],
                },
            });

            const result = await MapsTools.search_places({ query: 'Jazz clubs in Chicago', type: 'night_club' });

            expect(result.success).toBe(true);
            expect(mocks.findPlaces).toHaveBeenCalledWith({
                location: 'Jazz clubs in Chicago',
                type: 'night_club',
            });
            const data = result.data as { count: number; places: Array<{ name: string }> };
            expect(data.count).toBe(1);
            expect(data.places[0]!.name).toBe('The Shelter');
        });

        it('uses the full query as keyword when no type is provided', async () => {
            mocks.findPlaces.mockResolvedValue({ data: { places: [] } });

            await MapsTools.search_places({ query: 'Hotels in Nashville' });

            expect(mocks.findPlaces).toHaveBeenCalledWith({
                location: 'Hotels in Nashville',
                type: 'Hotels in Nashville',
            });
        });

        it('maps a not-found geocode to an honest LOCATION_NOT_FOUND error', async () => {
            mocks.findPlaces.mockRejectedValue({ code: 'not-found', message: 'Location not found' });

            const result = await MapsTools.search_places({ query: 'Nowhere, XX' });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('LOCATION_NOT_FOUND');
        });

        it('rejects empty queries without calling the backend', async () => {
            const result = await MapsTools.search_places({ query: '   ' });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_SEARCH_ARGUMENTS');
            expect(mocks.findPlaces).not.toHaveBeenCalled();
        });
    });

    describe('get_place_details', () => {
        it('stays honestly unavailable while no place-details proxy is deployed', async () => {
            const result = await MapsTools.get_place_details({ place_id: 'p1' });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('PLACE_DETAILS_UNAVAILABLE');
        });
    });

    describe('get_distance_matrix', () => {
        it('fails closed with AUTH_REQUIRED when unauthenticated', async () => {
            mocks.currentUser = null;

            const result = await MapsTools.get_distance_matrix({ origins: ['Detroit'], destinations: ['Chicago'] });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('AUTH_REQUIRED');
            expect(mocks.computeDistanceMatrix).not.toHaveBeenCalled();
        });

        it('returns real Google driving estimates from the secured proxy', async () => {
            mocks.computeDistanceMatrix.mockResolvedValue({
                data: {
                    scope: 'distance_matrix',
                    rows: [[
                        {
                            status: 'OK',
                            distanceMiles: 283.7,
                            distanceText: '283.7 mi',
                            durationMinutes: 262,
                            durationText: '4 hours 22 mins',
                        },
                    ]],
                    limitations: ['Distances and durations are Google driving estimates without live traffic.'],
                },
            });

            const result = await MapsTools.get_distance_matrix({ origins: ['Detroit'], destinations: ['Chicago'] });

            expect(result.success).toBe(true);
            expect(mocks.computeDistanceMatrix).toHaveBeenCalledWith({
                origins: ['Detroit'],
                destinations: ['Chicago'],
            });
            const data = result.data as { rows: Array<Array<{ distanceMiles: number }>> };
            expect(data.rows[0]![0]!.distanceMiles).toBe(283.7);
        });

        it('reports unresolvable legs instead of hiding them', async () => {
            mocks.computeDistanceMatrix.mockResolvedValue({
                data: {
                    scope: 'distance_matrix',
                    rows: [[{ status: 'NOT_FOUND' }]],
                    limitations: [],
                },
            });

            const result = await MapsTools.get_distance_matrix({ origins: ['Nowhere'], destinations: ['Chicago'] });

            expect(result.success).toBe(true);
            expect(result.message).toContain('unresolvable leg');
        });

        it('surfaces provider denial as MAPS_PROVIDER_DENIED', async () => {
            mocks.computeDistanceMatrix.mockRejectedValue({
                code: 'permission-denied',
                message: 'Distance Matrix requests are denied for the configured Maps key.',
            });

            const result = await MapsTools.get_distance_matrix({ origins: ['A'], destinations: ['B'] });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('MAPS_PROVIDER_DENIED');
        });

        it('rejects oversized requests without calling the backend', async () => {
            const result = await MapsTools.get_distance_matrix({
                origins: Array.from({ length: 11 }, (_, i) => `City ${i}`),
                destinations: ['Chicago'],
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_DISTANCE_ARGUMENTS');
            expect(mocks.computeDistanceMatrix).not.toHaveBeenCalled();
        });
    });
});
