
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalService } from './LegalService';
import { useStore } from '@/core/store';
import { ContractStatus } from '@/modules/legal/types';

// Mock dependencies
vi.mock('@/services/firebase', () => ({
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    addDoc: vi.fn(() => Promise.resolve({ id: 'mock-contract-id' })),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
    updateDoc: vi.fn(),
    Timestamp: { now: vi.fn() }
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

describe('LegalService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock authenticated user
        (useStore.getState as any).mockReturnValue({
            userProfile: { id: 'test-user-id' }
        });
    });

    it('should save a contract draft', async () => {
        const contractData = {
            title: 'Test NDA',
            type: 'NDA',
            parties: ['Me', 'You'],
            content: '# NDA',
            status: ContractStatus.DRAFT
        };

        const id = await LegalService.saveContract(contractData);
        expect(id).toBe('mock-contract-id');
    });

    it('should throw error if user not authenticated', async () => {
        (useStore.getState as any).mockReturnValue({ userProfile: null });
        await expect(LegalService.saveContract({} as any)).rejects.toThrow('User not authenticated');
    });
});
