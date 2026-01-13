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
    // Auth state moved to AuthSlice
    setOrganization: (id: string) => void;
    addOrganization: (org: Organization) => void;
    setUserProfile: (profile: UserProfile) => void;
    updateBrandKit: (updates: Partial<BrandKit>) => void;
    loadUserProfile: (uid: string) => Promise<void>;
    logout: () => Promise<void>;
    setTheme: (theme: 'dark' | 'light') => void;
}

// Default Guest Profile
const DEFAULT_USER_PROFILE: UserProfile = {
    id: 'guest',
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
        { id: 'org-default', name: 'HQ', plan: 'enterprise', members: ['guest'] }
    ],
    userProfile: DEFAULT_USER_PROFILE,
    // Auth state delegated to AuthSlice
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
    loadUserProfile: async (uid: string) => {
        console.info('[Profile] Loading user profile for:', uid);

        const storedOrgId = localStorage.getItem('currentOrgId');
        if (storedOrgId) {
            set({ currentOrganizationId: storedOrgId });
        }

        try {
            // Try to get from Firestore first (via Service/Repo) 
            const profile = await getProfileFromStorage(uid);
            if (profile) {
                console.info('[Profile] Loaded profile for:', uid);
                set({ userProfile: profile });
            } else {
                console.info('[Profile] No profile found, creating default for:', uid);
                // Create a new profile for this user
                const newProfile = { ...DEFAULT_USER_PROFILE, id: uid };
                set({ userProfile: newProfile });
                await saveProfileToStorage(newProfile);
            }
        } catch (err) {
            console.error('[Profile] Failed to load profile:', err);
        }
    },
    logout: async () => {
        console.info('[System] Logout requested - resetting session state...');
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
