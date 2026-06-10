import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TouringService } from './TouringService';
import { onSnapshot } from 'firebase/firestore';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'test-user', email: 'test@example.com' }
    },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/firestore')>();
    return {
        ...actual,
        collection: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        getDocs: vi.fn(),
        addDoc: vi.fn(),
        updateDoc: vi.fn(),
        doc: vi.fn(),
        onSnapshot: vi.fn(),
        serverTimestamp: vi.fn(),
    };
});

describe('TouringService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Prevent ZodError formatting crash in Vitest's console serializer
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });



    describe('subscribeToItineraries', () => {
        it('filters out invalid itineraries', () => {
            const validItinerary = {
                userId: 'user1',
                tourName: 'Tour 1',
                stops: [],
                totalDistance: '100km',
                estimatedBudget: '$1000'
            };

            const invalidItinerary = {
                userId: 'user1',
                tourName: 'Tour 2',
                // Missing stops, totalDistance, etc.
            };

            vi.mocked(onSnapshot).mockImplementation((query: any, callback: any) => {
                callback({
                    docs: [
                        { id: '1', data: () => validItinerary },
                        { id: '2', data: () => invalidItinerary }
                    ]
                } as unknown as import('firebase/firestore').QuerySnapshot);
                return () => { };
            });

            const callback = vi.fn();
            TouringService.subscribeToItineraries('user1', callback);

            expect(callback).toHaveBeenCalledWith([
                { id: '1', ...validItinerary }
            ]);
            // Should contain only the valid one
            expect(callback.mock.calls[0]![0]).toHaveLength(1);
        });
    });
});
