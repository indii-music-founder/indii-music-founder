import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProfileSlice, ProfileSlice } from './profileSlice';
import { createStore } from 'zustand';
import { saveProfileToStorage, getProfileFromStorage } from '@/services/storage/repository';
import { UserProfile } from '@/modules/workflow/types';

// Mock repository
vi.mock('@/services/storage/repository', () => ({
    saveProfileToStorage: vi.fn().mockResolvedValue(true),
    getProfileFromStorage: vi.fn()
}));

describe('ProfileSlice Persistence', () => {
    let useStore: any;

    const mockProfile: UserProfile = {
        id: 'guest',
        uid: 'guest',
        email: 'guest@example.com',
        displayName: 'Guest User',
        photoURL: null,
        createdAt: { seconds: 0, nanoseconds: 0 } as any,
        updatedAt: { seconds: 0, nanoseconds: 0 } as any,
        lastLoginAt: { seconds: 0, nanoseconds: 0 } as any,
        emailVerified: true,
        membership: { tier: 'pro', expiresAt: null },
        accountType: 'artist',
        bio: 'Test Bio',
        preferences: { theme: 'dark', notifications: true },
        brandKit: {
            colors: [],
            fonts: '',
            brandDescription: '',
            negativePrompt: '',
            socials: {},
            brandAssets: [],
            referenceImages: [],
            releaseDetails: {
                title: '',
                type: '',
                artists: '',
                genre: '',
                mood: '',
                themes: '',
                lyrics: ''
            }
        },
        analyzedTrackIds: [],
        knowledgeBase: [],
        savedWorkflows: [],
        careerStage: 'Established',
        goals: []
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Create a fresh store for each test
        useStore = createStore<ProfileSlice>((...a) => createProfileSlice(...a));
    });

    it('setUserProfile should update state and save to storage', () => {
        const { setUserProfile } = useStore.getState();

        setUserProfile(mockProfile);

        expect(useStore.getState().userProfile).toEqual(mockProfile);
        expect(saveProfileToStorage).toHaveBeenCalledWith(mockProfile);
    });

    it('updateBrandKit should update state and save to storage', () => {
        const { setUserProfile, updateBrandKit } = useStore.getState();
        setUserProfile(mockProfile);
        vi.mocked(saveProfileToStorage).mockClear();

        updateBrandKit({ brandDescription: 'New Brand' });

        const expectedProfile = {
            ...mockProfile,
            brandKit: {
                ...mockProfile.brandKit,
                brandDescription: 'New Brand'
            }
        };

        expect(useStore.getState().userProfile).toEqual(expectedProfile);
        expect(saveProfileToStorage).toHaveBeenCalledWith(expectedProfile);
    });

    it('loadUserProfile should load profile from storage', async () => {
        vi.mocked(getProfileFromStorage).mockResolvedValue(mockProfile);
        const { loadUserProfile } = useStore.getState();

        await loadUserProfile('test-uid');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(getProfileFromStorage).toHaveBeenCalledWith('test-uid');
        expect(useStore.getState().userProfile).toEqual(mockProfile);
    });

    it('loadUserProfile should use default profile if storage is empty', async () => {
        vi.mocked(getProfileFromStorage).mockResolvedValue(undefined);
        const { loadUserProfile, userProfile: initialDefault } = useStore.getState();

        // Ensure we expect the ID to be updated to the new UID
        const expectedDefault = { ...initialDefault, id: 'test-uid', uid: 'test-uid' };

        await loadUserProfile('test-uid');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(getProfileFromStorage).toHaveBeenCalledWith('test-uid');
        expect(useStore.getState().userProfile).toEqual(expectedDefault);
        expect(saveProfileToStorage).toHaveBeenCalledWith(expectedDefault);
    });
});
