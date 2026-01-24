import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TouringService } from './TouringService';
import { getDocs, onSnapshot } from 'firebase/firestore';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {}
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
    });

    describe('getVehicleStats', () => {
        it('validates and returns correct vehicle stats', async () => {
            const mockData = {
                userId: 'user1',
                milesDriven: 1000,
                fuelLevelPercent: 50,
                tankSizeGallons: 20,
                mpg: 25,
                gasPricePerGallon: 4.0
            };

            vi.mocked(getDocs).mockResolvedValueOnce({
                empty: false,
                docs: [{
                    id: 'doc1',
                    data: () => mockData
                }]
            } as any);

            const result = await TouringService.getVehicleStats('user1');
            expect(result).toEqual({ id: 'doc1', ...mockData });
        });

        it('returns null for invalid data (Zod validation failure)', async () => {
            const invalidData = {
                userId: 'user1',
                milesDriven: "NOT A NUMBER", // Invalid type
            };

            vi.mocked(getDocs).mockResolvedValueOnce({
                empty: false,
                docs: [{
                    id: 'doc1',
                    data: () => invalidData
                }]
            } as any);

            const result = await TouringService.getVehicleStats('user1');
            expect(result).toBeNull();
        });
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
                } as any);
                return () => { };
            });

            const callback = vi.fn();
            TouringService.subscribeToItineraries('user1', callback);

            expect(callback).toHaveBeenCalledWith([
                { id: '1', ...validItinerary }
            ]);
            // Should contain only the valid one
            expect(callback.mock.calls[0][0]).toHaveLength(1);
        });
    });
});
