import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialService } from './SocialService';

// --- Mocks ---

const {
    mockAddDoc,
    mockGetDoc,
    mockGetDocs,
    mockSetDoc,
    mockDeleteDoc,
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
        mockGetDoc: vi.fn(),
        mockGetDocs: vi.fn(),
        mockSetDoc: vi.fn(),
        mockDeleteDoc: vi.fn(),
        mockQuery: vi.fn(),
        mockCollection: vi.fn(),
        mockWhere: vi.fn(),
        mockOrderBy: vi.fn(),
        mockDoc: vi.fn(),
        mockUpdateDoc: vi.fn(),
        mockIncrement: vi.fn()
    };
});

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'user-123' }
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

vi.mock('firebase/firestore', () => ({
    addDoc: mockAddDoc,
    getDoc: mockGetDoc,
    getDocs: mockGetDocs,
    setDoc: mockSetDoc,
    deleteDoc: mockDeleteDoc,
    query: mockQuery,
    collection: mockCollection,
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: vi.fn(),
    serverTimestamp: () => 'MOCK_TIMESTAMP',
    doc: mockDoc,
    updateDoc: mockUpdateDoc,
    increment: mockIncrement,
    runTransaction: vi.fn(),
    Timestamp: {
        now: () => ({ toDate: () => new Date() }),
        fromMillis: vi.fn((millis: number) => ({ toMillis: () => millis, toDate: () => new Date(millis), seconds: Math.floor(millis / 1000), nanoseconds: 0 }))
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
            expect(mockCollection).toHaveBeenCalledWith({}, 'posts');
            expect(mockAddDoc).toHaveBeenCalledWith(
                'MOCK_COLLECTION_REF',
                expect.objectContaining({
                    authorId: 'user-123',
                    content: content,
                    productId: null,
                    timestamp: 'MOCK_TIMESTAMP'
                })
            );
            expect(result).toBe('new-post-id');
        });

        it('should create a Social Drop post (with productId)', async () => {
            mockAddDoc.mockResolvedValueOnce({ id: 'drop-post-id' });

            const content = "New Drop!";
            const productId = "product-999";

            const result = await SocialService.createPost(content, [], productId);

            // 1. Verify Post has productId
            expect(mockAddDoc).toHaveBeenCalledWith(
                'MOCK_COLLECTION_REF',
                expect.objectContaining({
                    content: content,
                    productId: productId
                })
            );
            expect(result).toBe('drop-post-id');
        });
    });

    describe('social_follows (ISSUE-1573)', () => {
        it('followUser creates a document in canonical social_follows collection', async () => {
            mockDoc.mockReturnValue('MOCK_FOLLOW_DOC_REF');
            mockSetDoc.mockResolvedValueOnce(undefined);

            await SocialService.followUser('user-target-456');

            expect(mockDoc).toHaveBeenCalledWith({}, 'social_follows', 'user-123_user-target-456');
            expect(mockSetDoc).toHaveBeenCalledWith(
                'MOCK_FOLLOW_DOC_REF',
                expect.objectContaining({
                    followerId: 'user-123',
                    followingId: 'user-target-456',
                    timestamp: 'MOCK_TIMESTAMP',
                })
            );
        });

        it('followUser refuses following self', async () => {
            await expect(SocialService.followUser('user-123')).rejects.toThrow('Cannot follow yourself');
            expect(mockSetDoc).not.toHaveBeenCalled();
        });

        it('unfollowUser deletes document in social_follows', async () => {
            mockDoc.mockReturnValue('MOCK_FOLLOW_DOC_REF');
            mockDeleteDoc.mockResolvedValueOnce(undefined);

            await SocialService.unfollowUser('user-target-456');

            expect(mockDoc).toHaveBeenCalledWith({}, 'social_follows', 'user-123_user-target-456');
            expect(mockDeleteDoc).toHaveBeenCalledWith('MOCK_FOLLOW_DOC_REF');
        });

        it('isFollowing checks existence in social_follows', async () => {
            mockDoc.mockReturnValue('MOCK_FOLLOW_DOC_REF');
            mockGetDoc.mockResolvedValueOnce({ exists: () => true });

            const following = await SocialService.isFollowing('user-target-456');

            expect(mockDoc).toHaveBeenCalledWith({}, 'social_follows', 'user-123_user-target-456');
            expect(mockGetDoc).toHaveBeenCalledWith('MOCK_FOLLOW_DOC_REF');
            expect(following).toBe(true);
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
            expect(feed[0]!.content).toBe('Post 1');
            expect(feed[0]!.timestamp).toBe(1000);
        });
    });
    describe('schedulePost', () => {
        it('refuses legacy Instagram callers that omit validated publishing metadata', async () => {
            await expect(SocialService.schedulePost({
                platform: 'Instagram',
                copy: 'New release',
                imageAsset: { assetType: 'image', title: 'Feed asset', imageUrl: 'https://test.com/feed.png', caption: '' },
                day: 1,
                scheduledTime: Date.now() + 60_000,
            })).rejects.toThrow('requires validated publishing metadata');

            expect(mockAddDoc).not.toHaveBeenCalled();
        });

        it('should add a post to scheduledPosts collection for delivery worker processing', async () => {
            mockAddDoc.mockResolvedValueOnce({ id: 'scheduled-id' });

            const post = {
                platform: 'Twitter' as const,
                copy: 'Test scheduled post',
                imageAsset: {
                    assetType: 'image' as const,
                    title: 'Test',
                    imageUrl: 'http://test.com/img.png',
                    caption: 'Caption'
                },
                day: 1,
                scheduledTime: Date.now() + 60_000
            };

            const id = await SocialService.schedulePost(post);

            expect(mockCollection).toHaveBeenCalledWith({}, 'scheduledPosts');
            expect(mockAddDoc).toHaveBeenCalledWith(
                'MOCK_COLLECTION_REF',
                expect.objectContaining({
                    userId: 'user-123',
                    authorId: 'user-123',
                    platform: 'twitter',
                    status: 'pending',
                    text: 'Test scheduled post',
                    source: 'social_dashboard'
                })
            );
            expect(id).toBe('scheduled-id');
        });
    });
});
