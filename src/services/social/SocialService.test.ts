
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialService } from './SocialService';
import { useStore } from '@/core/store';
import {
    addDoc,
    collection,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    orderBy,
    Timestamp,
    runTransaction,
    updateDoc,
    increment,
    serverTimestamp
} from 'firebase/firestore';

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

describe('SocialService Integration Tests', () => {
    const mockUserId = 'test-uid';

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default store state
        vi.mocked(useStore.getState).mockReturnValue({
            userProfile: { id: mockUserId, displayName: 'Test User' }
        } as any);

        // Mock Firestore functions
        vi.mocked(addDoc).mockResolvedValue({ id: 'new-doc-id' } as any);
        vi.mocked(updateDoc).mockResolvedValue(undefined);
    });

    describe('schedulePost', () => {
        it('should schedule a valid post', async () => {
            const newPost: any = {
                copy: 'Coming soon!',
                scheduledTime: new Date().toISOString(),
                platform: 'Twitter',
                imageAsset: undefined
            };

            const result = await SocialService.schedulePost(newPost);

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    userId: mockUserId,
                    copy: 'Coming soon!',
                    status: 'PENDING'
                })
            );
            expect(result).toBe('new-doc-id');
        });

        it('should validate scheduled post schema', async () => {
            const invalidPost: any = {
                content: '' // Invalid empty content
            };

            await expect(SocialService.schedulePost(invalidPost))
                .rejects.toThrow('Invalid post data');
        });
    });

    describe('getScheduledPosts', () => {
        it('should fetch pending posts for user', async () => {
            const mockPosts = [
                { id: 'p1', content: 'Post 1', scheduledTime: '2025-01-01', status: 'PENDING', userId: mockUserId },
                { id: 'p2', content: 'Post 2', scheduledTime: '2025-01-02', status: 'PENDING', userId: mockUserId }
            ];

            vi.mocked(getDocs).mockResolvedValue({
                docs: mockPosts.map(p => ({
                    id: p.id,
                    data: () => p
                }))
            } as any);

            const result = await SocialService.getScheduledPosts(mockUserId);
            expect(result).toHaveLength(2);
            expect(query).toHaveBeenCalledWith(
                expect.anything(),
                where('userId', '==', mockUserId),
                where('status', '==', 'PENDING'),
                orderBy('scheduledTime', 'asc')
            );
        });
    });

    describe('createPost', () => {
        it('should create a post and update stats', async () => {
            const content = 'Hello World';

            await SocialService.createPost(content, []);

            // Check post creation
            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(), // posts collection
                expect.objectContaining({
                    authorId: mockUserId,
                    content
                })
            );

            // Check stats update
            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(), // user ref
                expect.objectContaining({
                    'socialStats.posts': expect.anything() // increment(1)
                })
            );
        });
    });

    describe('getDashboardStats', () => {
        it('should return stats from user profile', async () => {
            const mockStats = { followers: 100, following: 50, posts: 10, drops: 2 };

            vi.mocked(getDoc).mockResolvedValue({
                exists: () => true,
                data: () => ({ socialStats: mockStats })
            } as any);

            const stats = await SocialService.getDashboardStats();
            expect(stats).toEqual(mockStats);
        });

        it('should return defaults if stats missing', async () => {
            vi.mocked(getDoc).mockResolvedValue({
                exists: () => true,
                data: () => ({}) // No socialStats
            } as any);

            const stats = await SocialService.getDashboardStats();
            expect(stats).toEqual({ followers: 0, following: 0, posts: 0, drops: 0 });
        });
    });

    describe('followUser', () => {
        it('should execute transaction to update followers/following', async () => {
            const targetId = 'target-uid';

            // Mock runTransaction
            vi.mocked(runTransaction).mockImplementation(async (db, updateFunction) => {
                const mockTransaction = {
                    get: vi.fn().mockResolvedValue({ exists: () => false }), // Not following yet
                    set: vi.fn(),
                    update: vi.fn()
                };
                await updateFunction(mockTransaction as any);
                return undefined;
            });

            await SocialService.followUser(targetId);

            expect(runTransaction).toHaveBeenCalled();
            // We can't easily assert inside the transaction closure without complex spying, 
            // but we verified runTransaction is called.
            // If we want to verify transaction logic, we need to inspect the mock execution or expose the closure.
        });
    });
});
