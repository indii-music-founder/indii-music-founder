import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProfileSlice, ProfileSlice } from './profileSlice';
import { createStore } from 'zustand';
import { saveProfileToStorage, getProfileFromStorage } from '@/services/storage/repository';
import { UserProfile } from '@/modules/workflow/types';

// Mock repository
vi.mock('@/services/storage/repository', () => ({
    saveProfileToStorage: vi.fn(),
    getProfileFromStorage: vi.fn()
}));

describe('ProfileSlice Persistence', () => {
    let useStore: any;

    const mockProfile: UserProfile = {
        id: 'superuser',
        bio: 'Test Bio',
        preferences: {},
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

    it('initializeAuth should load profile from storage', async () => {
        vi.mocked(getProfileFromStorage).mockResolvedValue(mockProfile);
        const { initializeAuth } = useStore.getState();

        await initializeAuth();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(getProfileFromStorage).toHaveBeenCalledWith('superuser');
        expect(useStore.getState().userProfile).toEqual(mockProfile);
    });

    it('initializeAuth should use default profile if storage is empty', async () => {
        vi.mocked(getProfileFromStorage).mockResolvedValue(undefined);
        const { initializeAuth, userProfile: initialDefault } = useStore.getState();

        await initializeAuth();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(getProfileFromStorage).toHaveBeenCalledWith('superuser');
        expect(useStore.getState().userProfile).toEqual(initialDefault);
        expect(saveProfileToStorage).toHaveBeenCalledWith(initialDefault);
    });
});
