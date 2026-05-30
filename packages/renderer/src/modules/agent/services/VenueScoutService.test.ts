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
        mockAddDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
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
    db: {},
    auth: { currentUser: { uid: 'test-user', email: 'test@example.com' }, onAuthStateChanged: vi.fn(), signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(), signOut: vi.fn() },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
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
        // Prevent ZodError formatting crash in Vitest's console serializer
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        // Clear cache by accessing private property (TS workaround or simple re-instantiation if possible, but static makes it hard.
        // We can mock Date.now() to expire cache if needed, or rely on distinct keys.
        // For testing, we'll use distinct cities/genres to avoid cache hits between tests unless intentional.
        (VenueScoutService as any).cache?.clear();

        // Default batch mock
        mockWriteBatch.mockReturnValue({
            set: vi.fn(),
            commit: vi.fn().mockResolvedValue(undefined)
        });
    });

    describe('searchVenues', () => {
        it('should validate inputs', async () => {
            try {
                await VenueScoutService.searchVenues('', 'Rock');
                expect.fail('Should have thrown an error');
            } catch (err: unknown) {
                expect(err instanceof Error ? err.message : '').toContain('Invalid search parameters');
            }
            try {
                await VenueScoutService.searchVenues('Nashville', '');
                expect.fail('Should have thrown an error');
            } catch (err: unknown) {
                expect(err instanceof Error ? err.message : '').toContain('Invalid search parameters');
            }
        });

        it('should not seed database when search results are empty', async () => {
            mockGetDocs.mockResolvedValueOnce({ docs: [] });

            const results = await VenueScoutService.searchVenues('Nashville', 'Rock');

            expect(results).toEqual([]);
            expect(mockWriteBatch).not.toHaveBeenCalled();
        });

        it('should return empty results without local fallback data', async () => {
            mockGetDocs.mockResolvedValueOnce({
                docs: []
            });

            await VenueScoutService.searchVenues('Memphis', 'Blues'); // Different city to avoid cache interference if any

            expect(mockWriteBatch).not.toHaveBeenCalled();
        });

        it('should return filtered and scored results', async () => {
            mockGetDocs.mockResolvedValueOnce({
                docs: [
                    { id: '1', data: () => MOCK_VENUE_A },
                    { id: '2', data: () => MOCK_VENUE_B }
                ]
            });

            const results = await VenueScoutService.searchVenues('Nashville', 'Rock');

            expect(results).toHaveLength(1);
            expect(results[0]!.name).toBe('Venue A');
            expect(results[0]!.fitScore).toBeGreaterThan(0);
        });

        it('should handle invalid Firestore data gracefully', async () => {
            mockGetDocs.mockResolvedValueOnce({
                docs: [
                    { id: '1', data: () => MOCK_VENUE_A },
                    { id: '3', data: () => ({ name: 'Invalid Venue', city: 'Nashville' }) } // Missing required fields like capacity, genres, status
                ]
            });

            const results = await VenueScoutService.searchVenues('Nashville', 'Rock');

            // Should only return the valid one
            expect(results).toHaveLength(1);
            expect(results[0]!.name).toBe('Venue A');
        });

        it('should throw on Firestore error', async () => {
            mockGetDocs.mockRejectedValue(new Error('Firestore offline'));

            await expect(VenueScoutService.searchVenues('Nashville', 'Indie'))
                .rejects.toThrow('Firestore offline');
        });

        it('should cache results', async () => {
            mockGetDocs.mockResolvedValueOnce({
                docs: [{ id: '1', data: () => MOCK_VENUE_A }]
            });

            const city = 'Austin';
            const genre = 'Rock';

            // First call
            await VenueScoutService.searchVenues(city, genre);
            expect(mockGetDocs).toHaveBeenCalledTimes(1);

            // Second call (Should hit cache)
            await VenueScoutService.searchVenues(city, genre);
            expect(mockGetDocs).toHaveBeenCalledTimes(1);
        });
    });

    describe('enrichVenue', () => {
        it('should update venue with enriched data', async () => {
            await VenueScoutService.enrichVenue('venue_123');

            expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'venues', 'venue_123');
            expect(mockUpdateDoc).toHaveBeenCalledWith(
                'MOCK_DOC_REF',
                expect.objectContaining({
                    lastScoutedAt: expect.any(Number)
                })
            );
        });
    });
});
