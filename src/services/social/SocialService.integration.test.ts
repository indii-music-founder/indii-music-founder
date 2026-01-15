import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SocialService } from './SocialService';
import { db } from '@/services/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { CampaignStatus } from './types';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {}
}));

// Mock Firestore
const mockAddDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: (...args: any[]) => mockCollection(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    runTransaction: vi.fn(),
    serverTimestamp: vi.fn(),
    updateDoc: vi.fn(),
    increment: vi.fn()
}));

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: { id: 'test-user-id' }
        })
    }
}));

describe('SocialService Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAddDoc.mockResolvedValue({ id: 'new-doc-id' });
    });

    it('schedulePost validates input correctly', async () => {
        const validPost = {
            platform: 'Twitter' as const,
            copy: 'Valid copy',
            day: 1,
            scheduledTime: Date.now()
        };

        const id = await SocialService.schedulePost(validPost);

        expect(id).toBe('new-doc-id');
        expect(mockAddDoc).toHaveBeenCalledWith(
            undefined, // In vitest mock, if implementation doesn't return value, it might be undefined or we check logic
            expect.objectContaining({
                copy: 'Valid copy',
                status: CampaignStatus.PENDING,
                authorId: 'test-user-id',
                platform: 'Twitter',
                day: 1
            })
        );
    });

    it('schedulePost throws error for invalid input', async () => {
        const invalidPost = {
            platform: 'Twitter' as const,
            copy: '', // Invalid: empty string
            day: 1,
            scheduledTime: Date.now()
        };

        await expect(SocialService.schedulePost(invalidPost)).rejects.toThrow(/Invalid post data/);
    });

    it('createPost validates input correctly', async () => {
        await SocialService.createPost('Hello World', ['https://example.com/image.jpg']);

        expect(mockAddDoc).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                content: 'Hello World',
                authorId: 'test-user-id',
                mediaUrls: ['https://example.com/image.jpg'],
                authorName: 'Anonymous',
                likes: 0
            })
        );
    });

    it('createPost throws error for invalid media URL', async () => {
        await expect(SocialService.createPost('Content', ['invalid-url']))
            .rejects.toThrow(/Invalid post content/);
    });
});
