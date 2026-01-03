
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveProfileToStorage, getProfileFromStorage } from './repository';
import { UserProfile } from '@/modules/workflow/types';

// Mock `idb` because it's an external dependency and uses IndexedDB which isn't available in Node environment
// However, `fake-indexeddb` should handle it if set up correctly in setup.ts.
// But we also want to mock Firebase parts.

const mockPut = vi.fn();
const mockGet = vi.fn();
const mockCreateObjectStore = vi.fn();
const mockObjectStoreNames = {
    contains: vi.fn().mockReturnValue(true)
};

// Mock idb
vi.mock('idb', () => ({
    openDB: vi.fn().mockImplementation(() => Promise.resolve({
        put: mockPut,
        get: mockGet,
        objectStoreNames: mockObjectStoreNames,
        createObjectStore: mockCreateObjectStore,
    })),
}));

// Mock Firebase
vi.mock('../firebase', () => ({
    db: {},
    storage: {},
    auth: { currentUser: { uid: 'test-user-uid' } }
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false }), // Default to not found in cloud
    collection: vi.fn(),
    getDocs: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
    ref: vi.fn(),
    uploadBytes: vi.fn(),
    getBlob: vi.fn(),
}));

describe('Profile Persistence', () => {
    const mockProfile: UserProfile = {
        id: 'guest',
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

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should save profile to storage', async () => {
        const profileForSync = { ...mockProfile, id: 'test-user-uid' };
        await saveProfileToStorage(profileForSync);

        expect(mockPut).toHaveBeenCalledWith('profile', profileForSync);
        // We also expect it to try to sync to cloud (mocked)
        const { setDoc } = await import('firebase/firestore');
        expect(setDoc).toHaveBeenCalled();
    });

    it('should load profile from storage', async () => {
        mockGet.mockResolvedValueOnce(mockProfile);

        const profile = await getProfileFromStorage('guest');

        expect(mockGet).toHaveBeenCalledWith('profile', 'guest');
        expect(profile).toEqual(mockProfile);
    });

    it('should return undefined if profile not found locally or cloud', async () => {
        mockGet.mockResolvedValueOnce(undefined);

        const profile = await getProfileFromStorage('guest');

        expect(profile).toBeUndefined();
    });
});
