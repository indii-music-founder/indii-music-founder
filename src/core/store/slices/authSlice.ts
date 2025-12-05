import { StateCreator } from 'zustand';
import { UserProfile, BrandKit } from '@/modules/workflow/types';

export interface Organization {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'enterprise';
    members: string[];
}

export interface AuthSlice {
    currentOrganizationId: string;
    organizations: Organization[];
    userProfile: UserProfile;
    setOrganization: (id: string) => void;
    addOrganization: (org: Organization) => void;
    setUserProfile: (profile: UserProfile) => void;
    updateBrandKit: (updates: Partial<BrandKit>) => void;
    initializeAuth: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
    currentOrganizationId: 'org-default',
    organizations: [
        { id: 'org-default', name: 'Personal Workspace', plan: 'free', members: ['me'] }
    ],
    userProfile: {
        bio: '',
        preferences: '',
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
                type: 'Single',
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
    },
    setOrganization: (id) => {
        localStorage.setItem('currentOrgId', id);
        set({ currentOrganizationId: id });
    },
    addOrganization: (org) => set((state) => ({ organizations: [...state.organizations, org] })),
    setUserProfile: (profile) => {
        localStorage.setItem('userProfile', JSON.stringify(profile));
        set({ userProfile: profile });
    },
    updateBrandKit: (updates) => set((state) => {
        const newProfile = {
            ...state.userProfile,
            brandKit: { ...state.userProfile.brandKit, ...updates }
        };
        localStorage.setItem('userProfile', JSON.stringify(newProfile));
        return { userProfile: newProfile };
    }),
    initializeAuth: () => {
        const storedOrgId = localStorage.getItem('currentOrgId');
        if (storedOrgId) {
            set({ currentOrganizationId: storedOrgId });
        }

        const storedProfile = localStorage.getItem('userProfile');
        if (storedProfile) {
            try {
                const parsed = JSON.parse(storedProfile);
                set({ userProfile: parsed });
            } catch (e) {
                console.error("Failed to parse stored profile", e);
            }
        }
    }
});
