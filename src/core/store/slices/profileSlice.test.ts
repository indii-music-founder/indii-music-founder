
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProfileSlice } from './profileSlice';
import { saveProfileToStorage } from '@/services/storage/repository';
import { UserProfile } from '@/modules/workflow/types';

// Mock repository
vi.mock('@/services/storage/repository', () => ({
    saveProfileToStorage: vi.fn().mockResolvedValue(undefined),
    getProfileFromStorage: vi.fn().mockResolvedValue(undefined)
}));

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
