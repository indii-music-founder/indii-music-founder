import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LicensingService } from './LicensingService';
import { FirestoreService } from '../FirestoreService';

// --- Mocks ---

const {
    mockAddDoc,
    mockGetDocs,
    mockQuery,
    mockCollection,
    mockWhere,
    mockOrderBy,
    mockDoc,
    mockUpdateDoc
} = vi.hoisted(() => {
    return {
        mockAddDoc: vi.fn(),
        mockGetDocs: vi.fn(),
        mockQuery: vi.fn(),
        mockCollection: vi.fn(),
        mockWhere: vi.fn(),
        mockOrderBy: vi.fn(),
        mockDoc: vi.fn(),
        mockUpdateDoc: vi.fn()
    }
});

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'user-123' }
    }
}));

vi.mock('firebase/firestore', () => ({
    collection: mockCollection,
    doc: mockDoc,
    addDoc: mockAddDoc,
    updateDoc: mockUpdateDoc,
    getDoc: vi.fn(),
    getDocs: mockGetDocs,
    query: mockQuery,
    where: mockWhere,
    orderBy: mockOrderBy,
    Timestamp: {
        now: () => ({ toDate: () => new Date() })
    }
}));

// We need to mock the internal state of LicensingService or just ensure FirestoreService works as expected
// Since LicensingService uses FirestoreService internally, we can either mock FirestoreService or the SDK.
// Let's mock the SDK and let FirestoreService run its logic.

describe('LicensingService', () => {
    let service: LicensingService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new LicensingService();
        mockCollection.mockReturnValue('MOCK_COLLECTION_REF');
    });

    describe('getActiveLicenses', () => {
        it('should fetch active licenses', async () => {
            const mockDocs = [
                {
                    id: 'lic-1',
                    data: () => ({ title: 'Song A', status: 'active' })
                }
            ];
            mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

            const result = await service.getActiveLicenses();

            expect(mockQuery).toHaveBeenCalled();
            expect(mockWhere).toHaveBeenCalledWith('status', '==', 'active');
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Song A');
        });
    });

    describe('getPendingRequests', () => {
        it('should fetch pending requests', async () => {
            const mockDocs = [
                {
                    id: 'req-1',
                    data: () => ({ title: 'Request A', status: 'checking' })
                }
            ];
            mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

            const result = await service.getPendingRequests();

            expect(mockQuery).toHaveBeenCalled();
            expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['checking', 'pending_approval', 'negotiating']);
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Request A');
        });
    });

    describe('createRequest', () => {
        it('should create a new license request', async () => {
            mockAddDoc.mockResolvedValueOnce({ id: 'new-req-id' });

            const requestData = {
                title: 'New Song',
                artist: 'New Artist',
                usage: 'YouTube',
                status: 'checking' as const,
                notes: 'Test notes'
            };

            const id = await service.createRequest(requestData);

            expect(mockAddDoc).toHaveBeenCalledWith(
                'MOCK_COLLECTION_REF',
                expect.objectContaining({
                    title: 'New Song',
                    status: 'checking'
                })
            );
            expect(id).toBe('new-req-id');
        });
    });

    describe('updateRequestStatus', () => {
        it('should update request status', async () => {
            mockDoc.mockReturnValue('MOCK_DOC_REF');

            await service.updateRequestStatus('req-1', 'negotiating');

            expect(mockUpdateDoc).toHaveBeenCalledWith(
                'MOCK_DOC_REF',
                expect.objectContaining({
                    status: 'negotiating'
                })
            );
        });
    });
});
