import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PublicistService } from './PublicistService';
import {
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    doc
} from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(),
    addDoc: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDocs: vi.fn(),
    writeBatch: vi.fn()
}));

// Mock db instance
vi.mock('../firebase', () => ({
    db: {}
}));

describe('PublicistService', () => {
    const minUserId = 'user123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('seedDatabase', () => {
        it('should seed database if no campaigns exist', async () => {
            // Mock getDocs to return empty snapshot
            (getDocs as any).mockResolvedValue({
                empty: true,
                docs: []
            });

            // Mock writeBatch
            const mockBatch = {
                set: vi.fn(),
                commit: vi.fn().mockResolvedValue(undefined)
            };
            (writeBatch as any).mockReturnValue(mockBatch);

            await PublicistService.seedDatabase(minUserId);

            // Verify query was constructed
            expect(collection).toHaveBeenCalled();
            expect(where).toHaveBeenCalledWith('userId', '==', minUserId);
            expect(getDocs).toHaveBeenCalled();

            // Verify batch operations
            expect(writeBatch).toHaveBeenCalled();
            expect(mockBatch.set).toHaveBeenCalled();
            expect(mockBatch.commit).toHaveBeenCalled();
        });

        it('should skip seeding if campaigns already exist', async () => {
            // Mock getDocs to return non-empty snapshot
            (getDocs as any).mockResolvedValue({
                empty: false,
                docs: [{ id: '1', data: () => ({}) }]
            });

            await PublicistService.seedDatabase(minUserId);

            // Verify batch was NOT called
            expect(writeBatch).not.toHaveBeenCalled();
        });

        it('should do nothing if userId is missing', async () => {
            await PublicistService.seedDatabase('');
            expect(getDocs).not.toHaveBeenCalled();
        });
    });
});
