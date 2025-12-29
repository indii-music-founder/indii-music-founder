import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialService } from './SocialService';

// --- Mocks ---

const {
    mockAddDoc,
    mockGetDocs,
    mockQuery,
    mockCollection,
    mockWhere,
    mockOrderBy,
    mockDoc,
    mockUpdateDoc,
    mockIncrement
} = vi.hoisted(() => {
    return {
        mockAddDoc: vi.fn(),
        mockGetDocs: vi.fn(),
        mockQuery: vi.fn(),
        mockCollection: vi.fn(),
        mockWhere: vi.fn(),
        mockOrderBy: vi.fn(),
        mockDoc: vi.fn(),
        mockUpdateDoc: vi.fn(),
        mockIncrement: vi.fn()
    }
});

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'user-123' }
    }
}));

vi.mock('firebase/firestore', () => ({
    addDoc: mockAddDoc,
    getDocs: mockGetDocs,
    query: mockQuery,
    collection: mockCollection,
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: vi.fn(),
    serverTimestamp: () => 'MOCK_TIMESTAMP',
    doc: mockDoc,
    updateDoc: mockUpdateDoc,
    increment: mockIncrement,
    runTransaction: vi.fn(), // Mocking transaction just in case
    Timestamp: {
        now: () => ({ toDate: () => new Date() })
    }
}));

// Mock Zustand store access
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            user: {
                uid: 'user-123',
                displayName: 'Test Artist',
                photoURL: 'http://test.com/avatar.jpg'
            },
            userProfile: { id: 'user-123', displayName: 'Test Artist' }
        })
    }
}));

// --- Test Suite ---

describe('SocialService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCollection.mockReturnValue('MOCK_COLLECTION_REF');
    });

    describe('createPost', () => {
        it('should create a standard post without products', async () => {
            mockAddDoc.mockResolvedValueOnce({ id: 'new-post-id' });

            const content = "Hello world!";
            const result = await SocialService.createPost(content);

            // 1. Verify Post Creation
            expect(mockCollection).toHaveBeenCalledWith({}, 'posts'); // db is {}, check logic
            expect(mockAddDoc).toHaveBeenCalledWith(
                'MOCK_COLLECTION_REF',
                expect.objectContaining({
                    authorId: 'user-123',
                    content: content,
                    productId: null,
                    timestamp: 'MOCK_TIMESTAMP'
                })
            );

            // 2. Verify User Stats Update
            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockIncrement).toHaveBeenCalledWith(1); // socialStats.posts
            expect(result).toBe('new-post-id');
        });

        it('should create a Social Drop post (with productId)', async () => {
            mockAddDoc.mockResolvedValueOnce({ id: 'drop-post-id' });

            const content = "New Drop!";
            const productId = "product-999";

            await SocialService.createPost(content, [], productId);

            // 1. Verify Post has productId
            expect(mockAddDoc).toHaveBeenCalledWith(
                'MOCK_COLLECTION_REF',
                expect.objectContaining({
                    content: content,
                    productId: productId
                })
            );

            // 2. Verify Stats update includes drops increment
            expect(mockUpdateDoc).toHaveBeenCalledWith(
                undefined, // docRef mock
                expect.objectContaining({
                    'socialStats.posts': undefined, // checking structure
                    'socialStats.drops': undefined
                })
            );
        });
    });

    describe('getFeed', () => {
        it('should fetch and format feed posts', async () => {
            const mockDocs = [
                {
                    id: 'post-1',
                    data: () => ({
                        content: 'Post 1',
                        authorId: 'user-A',
                        timestamp: { toMillis: () => 1000 }
                    })
                }
            ];
            mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

            const feed = await SocialService.getFeed();

            expect(mockQuery).toHaveBeenCalled();
            expect(feed).toHaveLength(1);
            expect(feed[0].content).toBe('Post 1');
            expect(feed[0].timestamp).toBe(1000);
        });
    });
});
