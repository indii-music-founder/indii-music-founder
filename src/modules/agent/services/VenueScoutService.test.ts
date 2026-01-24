import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VenueScoutService } from './VenueScoutService';

// Mock dependencies
const {
    mockGetDocs,
    mockAddDoc,
    mockCollection,
    mockQuery,
    mockWhere,
    mockUpdateDoc,
    mockDoc,
    mockWriteBatch,
    mockServerTimestamp
} = vi.hoisted(() => {
    return {
        mockGetDocs: vi.fn(),
        mockAddDoc: vi.fn(),
        mockCollection: vi.fn(),
        mockQuery: vi.fn(),
        mockWhere: vi.fn(),
        mockUpdateDoc: vi.fn(),
        mockDoc: vi.fn(() => 'MOCK_DOC_REF'),
        mockWriteBatch: vi.fn(),
        mockServerTimestamp: vi.fn()
    };
});

vi.mock('firebase/firestore', () => ({
    collection: mockCollection,
    getDocs: mockGetDocs,
    addDoc: mockAddDoc,
    query: mockQuery,
    where: mockWhere,
    updateDoc: mockUpdateDoc,
    doc: mockDoc,
    writeBatch: mockWriteBatch,
    serverTimestamp: mockServerTimestamp,
    getFirestore: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    db: {}
}));

vi.mock('../../../services/agent/BrowserAgentDriver', () => ({
    browserAgentDriver: {
        drive: vi.fn()
    }
}));

// Valid Mock Data
const MOCK_VENUE_A = {
    id: '1',
    name: 'Venue A',
    city: 'Nashville',
    state: 'TN',
    genres: ['Rock', 'Indie'],
    capacity: 500,
    status: 'active'
};

const MOCK_VENUE_B = {
    id: '2',
    name: 'Venue B',
    city: 'Nashville',
    state: 'TN',
    genres: ['Jazz'],
    capacity: 100,
    status: 'active'
};

describe('VenueScoutService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Clear cache by accessing private property (TS workaround or simple re-instantiation if possible, but static makes it hard.
        // We can mock Date.now() to expire cache if needed, or rely on distinct keys.
        // For testing, we'll use distinct cities/genres to avoid cache hits between tests unless intentional.

        // Default batch mock
        mockWriteBatch.mockReturnValue({
            set: vi.fn(),
            commit: vi.fn().mockResolvedValue(undefined)
        });
    });

    describe('searchVenues', () => {
        it('should validate inputs', async () => {
            await expect(VenueScoutService.searchVenues('', 'Rock')).rejects.toThrow('Invalid search parameters');
            await expect(VenueScoutService.searchVenues('Nashville', '')).rejects.toThrow('Invalid search parameters');
        });

        it('should seed database if empty', async () => {
            // Mock empty Nashville check (seeding check)
            mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

            // Mock query results for actual search (after seed)
            mockGetDocs.mockResolvedValueOnce({
                docs: [
                    { id: '1', data: () => MOCK_VENUE_A }
                ]
            });

            await VenueScoutService.searchVenues('Nashville', 'Rock');

            expect(mockWriteBatch).toHaveBeenCalled();
            // Should have seeded 5 venues (based on SEED_VENUES length)
            const batchMock = mockWriteBatch.mock.results[0].value;
            expect(batchMock.set).toHaveBeenCalledTimes(5);
        });

        it('should not seed if already populated', async () => {
            // Mock existing Nashville check
            mockGetDocs.mockResolvedValueOnce({ empty: false, docs: [{}] });
            // Mock query results
            mockGetDocs.mockResolvedValueOnce({
                docs: []
            });

            await VenueScoutService.searchVenues('Memphis', 'Blues'); // Different city to avoid cache interference if any

            expect(mockWriteBatch).not.toHaveBeenCalled();
        });

        it('should return filtered and scored results', async () => {
            // 1. _ensureSeeded call: return "not empty" to skip seeding
            mockGetDocs.mockResolvedValueOnce({ empty: false, docs: [{}] });

            // 2. searchVenues query call: return actual matches
            mockGetDocs.mockResolvedValueOnce({
                docs: [
                    { id: '1', data: () => MOCK_VENUE_A },
                    { id: '2', data: () => MOCK_VENUE_B }
                ]
            });

            const results = await VenueScoutService.searchVenues('Nashville', 'Rock');

            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('Venue A');
            expect(results[0].fitScore).toBeGreaterThan(0);
        });

        it('should handle invalid Firestore data gracefully', async () => {
             // 1. _ensureSeeded call
             mockGetDocs.mockResolvedValueOnce({ empty: false, docs: [{}] });

             // 2. searchVenues query call: return mixed valid/invalid data
             mockGetDocs.mockResolvedValueOnce({
                 docs: [
                     { id: '1', data: () => MOCK_VENUE_A },
                     { id: '3', data: () => ({ name: 'Invalid Venue', city: 'Nashville' }) } // Missing required fields like capacity, genres, status
                 ]
             });

             const results = await VenueScoutService.searchVenues('Nashville', 'Rock');

             // Should only return the valid one
             expect(results).toHaveLength(1);
             expect(results[0].name).toBe('Venue A');
        });

        it('should fallback to seed data on Firestore error', async () => {
            // 1. _ensureSeeded throws error
            mockGetDocs.mockRejectedValue(new Error('Firestore offline'));

            const results = await VenueScoutService.searchVenues('Nashville', 'Indie');

            // Should return results from local seed data
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].city).toBe('Nashville');
        });

        it('should cache results', async () => {
            // 1. _ensureSeeded
            mockGetDocs.mockResolvedValueOnce({ empty: false, docs: [{}] });
            // 2. First call DB fetch
            mockGetDocs.mockResolvedValueOnce({
                docs: [{ id: '1', data: () => MOCK_VENUE_A }]
            });

            const city = 'Austin';
            const genre = 'Rock';

            // First call
            await VenueScoutService.searchVenues(city, genre);
            expect(mockGetDocs).toHaveBeenCalledTimes(2); // 1 for seed check, 1 for fetch

            // Second call (Should hit cache)
            await VenueScoutService.searchVenues(city, genre);
            // mockGetDocs call count should still be 2
            expect(mockGetDocs).toHaveBeenCalledTimes(2);
        });
    });

    describe('enrichVenue', () => {
        it('should update venue with enriched data', async () => {
            await VenueScoutService.enrichVenue('venue_123');

            expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'venues', 'venue_123');
            expect(mockUpdateDoc).toHaveBeenCalledWith(
                'MOCK_DOC_REF',
                expect.objectContaining({
                    contactName: 'Talent Buyer'
                })
            );
        });
    });
});
