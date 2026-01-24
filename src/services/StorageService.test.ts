import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from './StorageService';
import { getDocs, orderBy } from 'firebase/firestore';

// Mock Firebase
vi.mock('./firebase', () => ({
    db: {},
    storage: {},
    auth: {}
}));

// Mock Firestore
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: (...args: any[]) => mockCollection(...args),
    addDoc: vi.fn(),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    query: (...args: any[]) => mockQuery(...args),
    orderBy: (...args: any[]) => mockOrderBy(...args),
    limit: (...args: any[]) => mockLimit(...args),
    where: (...args: any[]) => mockWhere(...args),
    Timestamp: {
        fromMillis: vi.fn()
    }
}));

// Mock OrganizationService
vi.mock('./OrganizationService', () => ({
    OrganizationService: {
        getCurrentOrgId: () => 'org-123'
    }
}));

describe('StorageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads history with server-side sorting', async () => {
        // Mock query snapshot
        mockGetDocs.mockResolvedValue({
            docs: [
                {
                    id: '1',
                    data: () => ({ timestamp: { toMillis: () => 1000 }, url: 'url1' })
                },
                {
                    id: '2',
                    data: () => ({ timestamp: { toMillis: () => 2000 }, url: 'url2' })
                }
            ]
        });

        await StorageService.loadHistory();

        // Verify orderBy was called
        expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'desc');

        // Verify query construction
        expect(mockQuery).toHaveBeenCalled();
        const queryArgs = mockQuery.mock.calls[0];
        // query(collection, where, orderBy, limit)
        // We can't easily check the exact arguments order without inspecting them, 
        // but we verified orderBy was called.
    });
});
