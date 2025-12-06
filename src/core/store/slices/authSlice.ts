import { StateCreator } from 'zustand';
import { UserProfile, BrandKit } from '@/modules/workflow/types';
import { User } from 'firebase/auth'; // Import Firebase User type

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
    user: User | null; // Add Firebase User object
    isAuthenticated: boolean;
    isAuthReady: boolean;
    setOrganization: (id: string) => void;
    addOrganization: (org: Organization) => void;
    setUserProfile: (profile: UserProfile) => void;
    updateBrandKit: (updates: Partial<BrandKit>) => void;
    initializeAuth: () => void;
    logout: () => Promise<void>; // Add logout
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
    user: null,
    isAuthenticated: false,
    isAuthReady: false,
    setOrganization: (id) => {
        localStorage.setItem('currentOrgId', id);
        set({ currentOrganizationId: id });
    },
    addOrganization: (org) => set((state) => ({ organizations: [...state.organizations, org] })),
    setUserProfile: (profile) => {
        // localStorage.setItem('userProfile', JSON.stringify(profile)); // Deprecate local storage sync? Or keep as cache?
        set({ userProfile: profile });
    },
    updateBrandKit: (updates) => set((state) => {
        const newProfile = {
            ...state.userProfile,
            brandKit: { ...state.userProfile.brandKit, ...updates }
        };
        // Update Firestore if logged in
        const user = state.user;
        if (user) {
            import('@/services/UserService').then(({ UserService }) => {
                // We need to map AppUserProfile back to what Firestore expects if necessary
                // For now, assume UserService handles Partial<UserContext> which includes AppUserProfile fields
                UserService.updateProfile(user.uid, { brandKit: newProfile.brandKit } as any);
            });
        }
        return { userProfile: newProfile };
    }),
    initializeAuth: () => {
        const storedOrgId = localStorage.getItem('currentOrgId');
        if (storedOrgId) {
            set({ currentOrganizationId: storedOrgId });
        }

        // Listen for Auth Changes
        import('@/services/firebase').then(({ auth }) => {
            const { onAuthStateChanged } = require('firebase/auth'); // Dynamic import for SDK functions if needed, or just use auth instance
            onAuthStateChanged(auth, async (user: User | null) => {
                if (user) {
                    set({ user, isAuthenticated: true, isAuthReady: true });

                    // Sync User Profile from Firestore
                    import('@/services/UserService').then(({ UserService }) => {
                        UserService.syncUserProfile(user).then((fullProfile) => {
                            // fullProfile is UserContext (User info + App Profile)
                            // We split it back to userProfile state
                            const appProfile: UserProfile = {
                                bio: fullProfile.bio || '',
                                preferences: JSON.stringify(fullProfile.preferences), // Convert back to string if needed by type
                                brandKit: fullProfile.brandKit,
                                analyzedTrackIds: fullProfile.analyzedTrackIds || [],
                                knowledgeBase: fullProfile.knowledgeBase || [],
                                savedWorkflows: fullProfile.savedWorkflows || []
                            };
                            set({ userProfile: appProfile });
                        });
                    });

                    // Fetch Organizations
                    import('@/services/OrganizationService').then(({ OrganizationService }) => {
                        OrganizationService.getUserOrganizations(user.uid).then(orgs => {
                            const mappedOrgs = orgs.map(o => ({
                                ...o,
                                plan: (o as any).plan || 'free',
                                members: (o as any).members || ['me']
                            }));
                            const defaultOrg = { id: 'org-default', name: 'Personal Workspace', plan: 'free' as const, members: ['me'] };
                            set({ organizations: [defaultOrg, ...mappedOrgs] });

                            // Check if current org is valid
                            const currentId = get().currentOrganizationId;
                            if (currentId !== 'org-default' && !mappedOrgs.find(o => o.id === currentId)) {
                                set({ currentOrganizationId: 'org-default' });
                            }
                        });
                    });

                } else {
                    set({ user: null, isAuthenticated: false, isAuthReady: true });
                    // Reset to default/anonymous state? 
                    // Or keep cached profile? For now, keep as is or clear.
                }
            });
        });
    },
    logout: async () => {
        const { signOut } = await import('firebase/auth');
        const { auth } = await import('@/services/firebase');
        await signOut(auth);
        set({
            user: null,
            isAuthenticated: false,
            currentOrganizationId: 'org-default'
            // Reset userProfile?
        });
        localStorage.removeItem('currentOrgId');
        // Redirect logic handled in App.tsx or component
    }
});
