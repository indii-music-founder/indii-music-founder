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

export const createAuthSlice: StateCreator<AuthSlice> = (set, get) => ({
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

        // Fetch user's organizations
        const { auth } = require('@/services/firebase');
        const user = auth.currentUser;
        if (user) {
            import('@/services/OrganizationService').then(({ OrganizationService }) => {
                OrganizationService.getUserOrganizations(user.uid).then(orgs => {
                    // Map to ensure 'plan' is present
                    const mappedOrgs = orgs.map(o => ({
                        ...o,
                        plan: (o as any).plan || 'free'
                    }));

                    const defaultOrg = { id: 'org-default', name: 'Personal Workspace', plan: 'free' as const, members: ['me'] };
                    set({ organizations: [defaultOrg, ...mappedOrgs] });

                    // If current org is not found in list (and not default), switch to default
                    const currentId = get().currentOrganizationId;
                    if (currentId !== 'org-default' && !mappedOrgs.find(o => o.id === currentId)) {
                        set({ currentOrganizationId: 'org-default' });
                        localStorage.setItem('currentOrgId', 'org-default');
                    }
                });
            });
        }
    }
});
