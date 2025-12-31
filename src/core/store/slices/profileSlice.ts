import { StateCreator } from 'zustand';
import { UserProfile, BrandKit } from '@/modules/workflow/types';
import { saveProfileToStorage, getProfileFromStorage } from '@/services/storage/repository';

export interface Organization {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'enterprise';
    members: string[];
}

export interface ProfileSlice {
    currentOrganizationId: string;
    organizations: Organization[];
    userProfile: UserProfile;
    // user: User | null; // REMOVED: No more Firebase User object. Identity is derived from profile.
    isAuthenticated: boolean;
    isAuthReady: boolean;
    setOrganization: (id: string) => void;
    addOrganization: (org: Organization) => void;
    setUserProfile: (profile: UserProfile) => void;
    updateBrandKit: (updates: Partial<BrandKit>) => void;
    initializeAuth: () => void; // Kept for interface compatibility but now just loads profile
    logout: () => Promise<void>;
    setTheme: (theme: 'dark' | 'light' | 'banana' | 'banana-pro') => void;
}

// Default Superuser Profile
const DEFAULT_USER_PROFILE: UserProfile = {
    id: 'superuser',
    bio: 'Creative Director',
    preferences: '{}',
    brandKit: {
        colors: ['#000000', '#ffffff'],
        fonts: 'Inter',
        brandDescription: 'My Studio Brand',
        negativePrompt: '',
        socials: {},
        brandAssets: [],
        referenceImages: [],
        releaseDetails: {
            title: 'Untitled Project',
            type: 'Single',
            artists: 'Me',
            genre: 'Pop',
            mood: 'Energetic',
            themes: 'Life',
            lyrics: ''
        }
    },
    analyzedTrackIds: [],
    knowledgeBase: [],
    savedWorkflows: [],
    careerStage: 'Established',
    goals: ['Global Domination']
};

export const createProfileSlice: StateCreator<ProfileSlice> = (set, get) => ({
    currentOrganizationId: 'org-default',
    organizations: [
        { id: 'org-default', name: 'HQ', plan: 'enterprise', members: ['superuser'] }
    ],
    userProfile: DEFAULT_USER_PROFILE,
    isAuthenticated: true, // ALWAYS AUTHENTICATED
    isAuthReady: true, // ALWAYS READY
    setOrganization: (id) => {
        localStorage.setItem('currentOrgId', id);
        set({ currentOrganizationId: id });
    },
    addOrganization: (org) => set((state) => ({ organizations: [...state.organizations, org] })),
    setUserProfile: (profile) => {
        set({ userProfile: profile });
        // Persistence Strategy: Hybrid (IndexedDB for speed + Firestore for cloud backup)
        saveProfileToStorage(profile).catch(err => console.error("[ProfileSlice] Failed to save profile:", err));
    },
    updateBrandKit: (updates) => set((state) => {
        const newProfile = {
            ...state.userProfile,
            brandKit: { ...state.userProfile.brandKit, ...updates }
        };
        saveProfileToStorage(newProfile).catch(err => console.error("[ProfileSlice] Failed to save profile update:", err));
        return { userProfile: newProfile };
    }),
    initializeAuth: () => {
        console.log('[System] Initializing Core Profile...');
        const storedOrgId = localStorage.getItem('currentOrgId');
        if (storedOrgId) {
            set({ currentOrganizationId: storedOrgId });
        }

        // Load profile from storage
        getProfileFromStorage('superuser').then((profile) => {
            if (profile) {
                console.log('[System] Loaded profile from storage');
                set({ userProfile: profile });
            } else {
                console.log('[System] No profile found in storage, using default');
                // Persist default profile so we have it for next time
                saveProfileToStorage(DEFAULT_USER_PROFILE).catch(err => console.error("Failed to save default profile:", err));
            }
        }).catch(err => {
            console.error('[System] Failed to load profile from storage:', err);
        });
    },
    logout: async () => {
        console.log('[System] Logout requested - resetting session state...');
        // In a no-auth world, "logout" might just reset preferences or switch to a guest profile.
        // For now, we just reload the page to clear transient state
        window.location.reload();
    },
    setTheme: (theme) => set((state) => {
        const preferences = typeof state.userProfile.preferences === 'string'
            ? JSON.parse(state.userProfile.preferences || '{}')
            : { ...state.userProfile.preferences };

        const newProfile = {
            ...state.userProfile,
            preferences: { ...preferences, theme }
        };
        saveProfileToStorage(newProfile).catch(err => console.error("[ProfileSlice] Failed to save theme update:", err));
        return { userProfile: newProfile };
    })
});
