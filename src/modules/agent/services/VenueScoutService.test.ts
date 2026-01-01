import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VenueScoutService } from './VenueScoutService';
import { Venue } from '../types';

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

describe('VenueScoutService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Default batch mock
        mockWriteBatch.mockReturnValue({
            set: vi.fn(),
            commit: vi.fn().mockResolvedValue(undefined)
        });
    });

    describe('searchVenues', () => {
        it('should seed database if empty', async () => {
            // Mock empty Nashville check
            mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
            // Mock query results for actual search
            mockGetDocs.mockResolvedValueOnce({
                docs: [
                    { id: '1', data: () => ({ city: 'Nashville', genres: ['Rock'], capacity: 500 }) }
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

            await VenueScoutService.searchVenues('Nashville', 'Rock');

            expect(mockWriteBatch).not.toHaveBeenCalled();
        });

        it('should return filtered and scored results', async () => {
            // 1. _ensureSeeded call: return "not empty" to skip seeding
            mockGetDocs.mockResolvedValueOnce({ empty: false, docs: [{}] });

            // 2. searchVenues query call: return actual matches
            mockGetDocs.mockResolvedValueOnce({
                docs: [
                    { id: '1', data: () => ({ city: 'Nashville', genres: ['Rock', 'Indie'], capacity: 500, name: 'Venue A' }) },
                    { id: '2', data: () => ({ city: 'Nashville', genres: ['Jazz'], capacity: 100, name: 'Venue B' }) } // Wrong genre
                ]
            });

            const results = await VenueScoutService.searchVenues('Nashville', 'Rock');

            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('Venue A');
            expect(results[0].fitScore).toBeGreaterThan(0);
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
