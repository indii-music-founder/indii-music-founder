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
        const personalQuery = mockOnSnapshot.mock.calls
            .map(([q]) => q)
            .find((q) => q.constraints.some((constraint: { field?: string; value?: string }) =>
                constraint.field === 'orgId' && constraint.value === 'personal'
            ));
        expect(personalQuery?.constraints).toContainEqual({
            type: 'where',
            field: 'userId',
            op: '==',
            value: 'test-user-123'
        });
        expect(updates.at(-1)?.map(item => item.id)).toEqual([
            'personal-web-image',
            'org-image'
        ]);

        unsubscribe();
    });

    it('detaches the failed primary listener before attaching the fallback, and never accumulates fallbacks on repeated index errors', async () => {
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

        const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];
        const errorCallbacks: Array<(err: { code: string; message: string }) => void> = [];

        mockOnSnapshot.mockImplementation((q, onNext, onError) => {
            const unsub = vi.fn();
            unsubscribes.push(unsub);
            const isPrimary = q.constraints.some((c: { type?: string }) => c.type === 'orderBy');
            if (isPrimary) {
                // Primary queries are orderBy queries; capture their error path.
                errorCallbacks.push(onError as (err: { code: string; message: string }) => void);
            } else {
                // Fallback query (no orderBy) — deliver docs.
                const orgFilter = q.constraints.find((c: { field?: string }) => c.field === 'orgId');
                onNext({ docs: [docFor(`fallback-${String(orgFilter?.value)}`, 1500, String(orgFilter?.value))] });
            }
            return unsub;
        });

        const updates: Array<Array<{ id: string }>> = [];
        const unsubscribe = await StorageService.subscribeToHistory(
            50,
            (items) => updates.push(items),
            () => { }
        );

        // org + personal primary listeners registered first.
        expect(errorCallbacks).toHaveLength(2);

        // Simulate the org query failing with a missing index — twice. A
        // Firestore listener stays alive on error and keeps retrying, so a
        // second error event must NOT attach a second fallback listener.
        errorCallbacks[0]!({ code: 'failed-precondition', message: 'The query requires an index.' });
        errorCallbacks[0]!({ code: 'failed-precondition', message: 'The query requires an index.' });

        // Exactly one fallback attached: 2 primaries + 1 fallback, not 3.
        expect(mockOnSnapshot).toHaveBeenCalledTimes(3);

        // The failed primary listener was detached (it would otherwise keep
        // retrying the dead query and duplicate every delivery).
        expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
        // The healthy personal primary listener is untouched.
        expect(unsubscribes[1]).not.toHaveBeenCalled();

        // The fallback's docs flow into the merged updates.
        await vi.waitFor(() => {
            expect(updates.at(-1)?.map(item => item.id)).toContain('fallback-org-123');
        });

        unsubscribe();
    });
});
