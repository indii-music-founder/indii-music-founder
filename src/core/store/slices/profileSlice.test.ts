
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProfileSlice, ProfileSlice } from './profileSlice';
import { createStore } from 'zustand';
import { saveProfileToStorage, getProfileFromStorage } from '@/services/storage/repository';

import { UserProfile } from '@/modules/workflow/types';

// Mock repository
vi.mock('@/services/storage/repository', () => ({
    saveProfileToStorage: vi.fn().mockResolvedValue(undefined),
    getProfileFromStorage: vi.fn()
}));

// Mock console.error to avoid noise
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

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
        vi.mocked(saveProfileToStorage).mockClear(); // Clear the call from setUserProfile

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

        // Wait a tick for the promise to resolve (initializeAuth is not async in interface but implementations are async inside)
        // Actually initializeAuth implementation calls .then(), so we need to wait.
        // Since initializeAuth returns void, we can't await it directly.
        // We rely on the mock resolving immediately.

        // Wait for promises to settle
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
        // It should also persist the default profile
        expect(saveProfileToStorage).toHaveBeenCalledWith(initialDefault);
    });


});

describe('profileSlice', () => {
    let set: any;
    let get: any;
    let slice: any;

    beforeEach(() => {
        set = vi.fn((update) => {
            // Very basic mock of Zustand set
            if (typeof update === 'function') {
                const newState = update(get());
                Object.assign(slice, newState);
            } else {
                Object.assign(slice, update);
            }
        });
        get = vi.fn(() => slice);
        slice = createProfileSlice(set, get, {} as any);
        vi.clearAllMocks();
    });

    it('setUserProfile should update state and persist profile', () => {
        const mockProfile: UserProfile = {
            id: 'test-user',
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
            savedWorkflows: []
        };

        slice.setUserProfile(mockProfile);

        // Check state update
        expect(set).toHaveBeenCalledWith({ userProfile: mockProfile });

        // Check persistence
        expect(saveProfileToStorage).toHaveBeenCalledWith(mockProfile);
    });

    it('updateBrandKit should update state and persist profile', () => {
        const initialProfile = slice.userProfile;
        const updates = { brandDescription: 'New Description' };

        slice.updateBrandKit(updates);

        // Check persistence
        const expectedProfile = {
            ...initialProfile,
            brandKit: { ...initialProfile.brandKit, ...updates }
        };
        expect(saveProfileToStorage).toHaveBeenCalledWith(expectedProfile);
    });
});
