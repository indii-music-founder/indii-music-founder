import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../../services/UserService';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { UserProfile } from '@/types/User';


// Mock Firebase
vi.mock('../../services/firebase', () => ({
    db: {},
    auth: {}
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    serverTimestamp: vi.fn(),
    Timestamp: {
        now: vi.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
        fromDate: vi.fn()
    },
    SetOptions: {}
}));

describe('UserService', () => {
    const mockUser = {
        uid: 'test-uid-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
        emailVerified: true
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('syncUserProfile creates a new profile if not found', async () => {
        // Setup: getDoc returns "not exists"
        (getDoc as any).mockResolvedValue({ exists: () => false });

        const profile = await UserService.syncUserProfile(mockUser as any);

        // Verify docRef creation
        expect(doc).toHaveBeenCalledWith(db, 'users', mockUser.uid);

        // Verify setDoc was called with correct structure
        expect(setDoc).toHaveBeenCalledWith(
            undefined, // docRef result (mocked undefined)
            expect.objectContaining({
                uid: mockUser.uid,
                email: mockUser.email,
                displayName: mockUser.displayName,
                brandKit: expect.objectContaining({
                    colors: expect.any(Array)
                })
            })
        );

        // Verify result matches inputs
        expect(profile.uid).toBe(mockUser.uid);
        expect(profile.membership.tier).toBe('free');
        expect(profile.brandKit).toBeDefined();
    });

    it('syncUserProfile updates lastLoginAt if profile exists', async () => {
        const existingData: UserProfile = {
            uid: mockUser.uid,
            email: mockUser.email,
            displayName: "Old Name",
            photoURL: null,
            createdAt: {} as any,
            updatedAt: {} as any,
            lastLoginAt: {} as any,
            emailVerified: true,
            membership: { tier: 'pro', expiresAt: null },
            preferences: { theme: 'dark', notifications: true },
            bio: '',
            brandKit: { existing: true } as any,
            analyzedTrackIds: [],
            knowledgeBase: [],
            savedWorkflows: [],
            careerStage: 'Emerging',
            goals: []
        };

        // Setup: getDoc returns "exists" with data
        (getDoc as any).mockResolvedValue({
            exists: () => true,
            data: () => existingData
        });

        const profile = await UserService.syncUserProfile(mockUser as any);

        // Verify updateDoc called
        expect(updateDoc).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                lastLoginAt: expect.any(Object)
            })
        );

        // Verify returned profile is the EXISTING one (not overwritten)
        expect(profile.membership.tier).toBe('pro');
        expect((profile.brandKit as any).existing).toBe(true);
    });

    it('updateProfile merges data correctly', async () => {
        const updates: Partial<UserProfile> = {
            bio: 'New Bio',
            membership: { tier: 'enterprise', expiresAt: null }
        };

        await UserService.updateProfile(mockUser.uid, updates);

        expect(updateDoc).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                ...updates,
                updatedAt: expect.any(Object)
            })
        );
    });
});
