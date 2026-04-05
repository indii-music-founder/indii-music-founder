import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MapsTools } from '../MapsTools';

// Mock env
vi.mock('@/config/env', () => ({
    env: {
        googleMapsApiKey: 'TEST_API_KEY'
    }
}));

describe('MapsTools', () => {
    let googleMock: Record<string, unknown>;
    let textSearchMock: import('vitest').Mock;
    let getDetailsMock: import('vitest').Mock;
    let getDistanceMatrixMock: import('vitest').Mock;

    beforeEach(() => {
        textSearchMock = vi.fn();
        getDetailsMock = vi.fn();
        getDistanceMatrixMock = vi.fn();

        class MockPlacesService {
            textSearch(req: unknown, cb: (res: unknown, status: string) => void) { textSearchMock(req, cb); }
            getDetails(req: unknown, cb: (res: unknown, status: string) => void) { getDetailsMock(req, cb); }
        }

        class MockDistanceMatrixService {
            getDistanceMatrix(req: unknown, cb: (res: unknown, status: string) => void) { getDistanceMatrixMock(req, cb); }
        }

        // Setup global google mock
        googleMock = {
            maps: {
                places: {
                    PlacesService: MockPlacesService,
                    PlacesServiceStatus: { OK: 'OK' }
                },
                DistanceMatrixService: MockDistanceMatrixService,
                DistanceMatrixStatus: { OK: 'OK' },
                TravelMode: { DRIVING: 'DRIVING' }
            }
        };
        (window as unknown as { google: Record<string, unknown> }).google = googleMock;

        // Mock document.createElement to avoid script injection during test
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            return {} as never;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as unknown as { google?: Record<string, unknown> }).google;
    });

    it('search_places calls textSearch and formats results', async () => {
        const mockResults = [
            { name: 'Place A', formatted_address: '123 Main', rating: 4.5, place_id: 'p1', types: ['restaurant'], opening_hours: { isOpen: () => true } }
        ];

        textSearchMock.mockImplementation((req: unknown, cb: (res: unknown, status: string) => void) => cb(mockResults, 'OK'));

        const result = await MapsTools.search_places({ query: 'pizza' });

        expect(textSearchMock).toHaveBeenCalledWith(expect.objectContaining({ query: 'pizza' }), expect.any(Function));
        expect(result.success).toBe(true);
        expect(result.data.results).toHaveLength(1);
        expect(result.data.results[0].name).toBe('Place A');
        expect(result.data.results[0].open_now).toBe(true);
    });

    it('get_place_details calls getDetails and formats result', async () => {
        const mockPlace = {
            name: 'Place A',
            formatted_address: '123 Main',
            formatted_phone_number: '555-1234',
            rating: 4.5,
            reviews: [{ author_name: 'User 1', text: 'Great', rating: 5 }],
            opening_hours: { weekday_text: ['Mon: 9-5'] }
        };

        getDetailsMock.mockImplementation((req: unknown, cb: (res: unknown, status: string) => void) => cb(mockPlace, 'OK'));

        const result = await MapsTools.get_place_details({ place_id: 'p1' });

        expect(getDetailsMock).toHaveBeenCalledWith(expect.objectContaining({ placeId: 'p1' }), expect.any(Function));
        expect(result.success).toBe(true);
        expect(result.data.name).toBe('Place A');
        expect(result.data.reviews[0].author).toBe('User 1');
    });

    it('get_distance_matrix calls service and formats result', async () => {
        const mockResponse = {
            rows: [
                {
                    elements: [
                        { distance: { text: '10 km' }, duration: { text: '15 mins' }, status: 'OK' }
                    ]
                }
            ]
        };

        getDistanceMatrixMock.mockImplementation((req: unknown, cb: (res: unknown, status: string) => void) => cb(mockResponse, 'OK'));

        const result = await MapsTools.get_distance_matrix({ origins: ['A'], destinations: ['B'] });

        expect(getDistanceMatrixMock).toHaveBeenCalledWith(expect.objectContaining({ origins: ['A'], destinations: ['B'] }), expect.any(Function));
        expect(result.success).toBe(true);
        expect(result.data.results[0].distance).toBe('10 km');
        expect(result.data.results[0].duration).toBe('15 mins');
    });
});
