import { describe, it, expect, vi } from 'vitest';

// Define mocks hoisted
const mocks = vi.hoisted(() => ({
    addDoc: vi.fn(),
    collection: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    collection: mocks.collection,
    addDoc: mocks.addDoc,
    Timestamp: { fromDate: vi.fn(d => d) }
}));

// Import AFTER mocks
import { seedRevenue } from './RevenueSeeder';

describe('RevenueSeeder', () => {
    it('should seed 50 records', async () => {
        const mockDb = {};
        const count = await seedRevenue(mockDb, 'test-user');

        expect(count).toBe(50);
        expect(mocks.collection).toHaveBeenCalledWith(mockDb, 'revenue');
        expect(mocks.addDoc).toHaveBeenCalledTimes(50);
    });
});
