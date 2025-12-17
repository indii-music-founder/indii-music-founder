import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { search_places, get_place_details, get_distance_matrix } from './MapsTools';

// Mock env
vi.mock('@/config/env', () => ({
    env: {
        googleMapsApiKey: 'TEST_API_KEY'
    }
}));

describe('MapsTools', () => {
    let googleMock: any;
    let textSearchMock: any;
    let getDetailsMock: any;
    let getDistanceMatrixMock: any;

    beforeEach(() => {
        textSearchMock = vi.fn();
        getDetailsMock = vi.fn();
        getDistanceMatrixMock = vi.fn();

        class MockPlacesService {
            textSearch(req: any, cb: any) { textSearchMock(req, cb); }
            getDetails(req: any, cb: any) { getDetailsMock(req, cb); }
        }

        class MockDistanceMatrixService {
            getDistanceMatrix(req: any, cb: any) { getDistanceMatrixMock(req, cb); }
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
        (window as any).google = googleMock;

        // Mock document.createElement to avoid script injection during test
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'script') {
                return {} as any;
            }
            return {} as any;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as any).google;
    });

    it('search_places calls textSearch and formats results', async () => {
        const mockResults = [
            { name: 'Place A', formatted_address: '123 Main', rating: 4.5, place_id: 'p1', types: ['restaurant'], opening_hours: { isOpen: () => true } }
        ];

        textSearchMock.mockImplementation((req: any, cb: any) => cb(mockResults, 'OK'));

        const result = await search_places({ query: 'pizza' });
        const parsed = JSON.parse(result);

        expect(textSearchMock).toHaveBeenCalledWith(expect.objectContaining({ query: 'pizza' }), expect.any(Function));
        expect(parsed).toHaveLength(1);
        expect(parsed[0].name).toBe('Place A');
        expect(parsed[0].open_now).toBe(true);
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

        getDetailsMock.mockImplementation((req: any, cb: any) => cb(mockPlace, 'OK'));

        const result = await get_place_details({ place_id: 'p1' });
        const parsed = JSON.parse(result);

        expect(getDetailsMock).toHaveBeenCalledWith(expect.objectContaining({ placeId: 'p1' }), expect.any(Function));
        expect(parsed.name).toBe('Place A');
        expect(parsed.reviews[0].author).toBe('User 1');
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

        getDistanceMatrixMock.mockImplementation((req: any, cb: any) => cb(mockResponse, 'OK'));

        const result = await get_distance_matrix({ origins: ['A'], destinations: ['B'] });
        const parsed = JSON.parse(result);

        expect(getDistanceMatrixMock).toHaveBeenCalledWith(expect.objectContaining({ origins: ['A'], destinations: ['B'] }), expect.any(Function));
        expect(parsed[0].distance).toBe('10 km');
        expect(parsed[0].duration).toBe('15 mins');
    });
});
