import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from './StorageService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getDocs, orderBy } from 'firebase/firestore';

// Mock Firebase
vi.mock('./firebase', () => ({
  serverTimestamp: vi.fn(),
    db: {},
    storage: {},
    auth: {
        currentUser: { uid: 'test-user-123' }
    }
}));

// Mock Firestore
const { mockGetDocs, mockQuery, mockCollection, mockWhere, mockOrderBy, mockLimit, mockOnSnapshot } = vi.hoisted(() => {
    return {
        mockGetDocs: vi.fn(),
        mockQuery: vi.fn(),
        mockCollection: vi.fn(),
        mockWhere: vi.fn(),
        mockOrderBy: vi.fn(),
        mockLimit: vi.fn(),
        mockOnSnapshot: vi.fn()
    };
});

vi.mock('firebase/firestore', () => {
    return {
        serverTimestamp: vi.fn(),
        collection: (...args: any[]) => mockCollection(...args),
        addDoc: vi.fn(),
        getDocs: (...args: any[]) => mockGetDocs(...args),
        query: (...args: any[]) => mockQuery(...args),
        orderBy: (...args: any[]) => mockOrderBy(...args),
        limit: (...args: any[]) => mockLimit(...args),
        where: (...args: any[]) => mockWhere(...args),
        onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
        Timestamp: {
            fromMillis: vi.fn()
        }
    };
});

// Mock OrganizationService
vi.mock('./OrganizationService', () => ({
    serverTimestamp: vi.fn(),
    OrganizationService: {
        getCurrentOrgId: () => 'org-123'
    }
}));

describe('StorageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCollection.mockImplementation((_db, path) => ({ path }));
        mockWhere.mockImplementation((field, op, value) => ({ type: 'where', field, op, value }));
        mockOrderBy.mockImplementation((field, direction) => ({ type: 'orderBy', field, direction }));
        mockLimit.mockImplementation((count) => ({ type: 'limit', count }));
        mockQuery.mockImplementation((collectionRef, ...constraints) => ({ collectionRef, constraints }));
    });

    it('loads history with server-side sorting', async () => {
        // Mock query snapshot
        mockGetDocs.mockResolvedValue({
            docs: [
                {
                    id: '1',
                    data: () => ({
  serverTimestamp: vi.fn(), timestamp: { toMillis: () => 1000 }, url: 'url1' })
                },
                {
                    id: '2',
                    data: () => ({
  serverTimestamp: vi.fn(), timestamp: { toMillis: () => 2000 }, url: 'url2' })
                }
            ]
        });

        await StorageService.loadHistory();

        // Verify orderBy was called
        expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'desc');

        // Verify query construction
        expect(mockQuery).toHaveBeenCalled();
        const _queryArgs = mockQuery.mock.calls[0];
        // query(collection, where, orderBy, limit)
        // We can't easily check the exact arguments order without inspecting them, 
        // but we verified orderBy was called.
    });

    it('subscribes to active org history and personal vault history together', async () => {
        const docFor = (id: string, timestamp: number, orgId: string) => ({
            id,
            data: () => ({
                id,
                type: 'image',
                url: `https://cdn.test/${id}.png`,
                prompt: id,
                timestamp: { toMillis: () => timestamp },
                projectId: 'project-1',
                orgId,
                userId: 'test-user-123',
                origin: 'generated'
            })
        });

        mockOnSnapshot.mockImplementation((q, onNext) => {
            const orgFilter = q.constraints.find((constraint: { field?: string }) => constraint.field === 'orgId');
            const orgId = orgFilter?.value;
            const docs = orgId === 'personal'
                ? [docFor('personal-web-image', 2000, 'personal')]
                : [docFor('org-image', 1000, 'org-123')];
            onNext({ docs });
            return vi.fn();
        });

        const updates: Array<Array<{ id: string }>> = [];
        const unsubscribe = await StorageService.subscribeToHistory(
            50,
            (items) => updates.push(items),
            (error) => { throw error; }
        );

        expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
        expect(updates.at(-1)?.map(item => item.id)).toEqual([
            'personal-web-image',
            'org-image'
        ]);

        unsubscribe();
    });
});
