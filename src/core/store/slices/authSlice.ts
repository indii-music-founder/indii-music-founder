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
            import('@/modules/auth/UserService').then(({ UserService }) => {
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
        import('@/services/firebase').then(async ({ auth }) => {
            const { onAuthStateChanged } = await import('firebase/auth');

            // Bypass for E2E Tests
            // @ts-ignore
            if (window.__TEST_MODE__) {
                console.log("[AuthSlice] Test Mode detected - skipping Firebase Auth listener");
                return;
            }

            onAuthStateChanged(auth, async (user: User | null) => {
                if (user) {
                    // Only consider non-anonymous users as fully authenticated for the Dashboard
                    // Anonymous users (if any) need to upgrade/sign-in to access protected data
                    const isAuthenticated = !user.isAnonymous;
                    set({ user, isAuthenticated, isAuthReady: true });

                    // Sync User Profile from Firestore
                    import('@/modules/auth/UserService').then(({ UserService }) => {
                        UserService.syncUserProfile(user).then((fullProfile) => {
                            const appProfile: UserProfile = {
                                id: user.uid, // Populate ID from auth user
                                bio: fullProfile.bio || '',
                                preferences: typeof fullProfile.preferences === 'string' ? fullProfile.preferences : JSON.stringify(fullProfile.preferences || {}),
                                brandKit: fullProfile.brandKit || {
                                    colors: [],
                                    fonts: '',
                                    brandDescription: '',
                                    negativePrompt: '',
                                    socials: {},
                                    brandAssets: [],
                                    referenceImages: [],
                                    releaseDetails: { title: '', type: 'Single', artists: '', genre: '', mood: '', themes: '', lyrics: '' }
                                },
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

                            const currentId = get().currentOrganizationId;
                            if (currentId !== 'org-default' && !mappedOrgs.find(o => o.id === currentId)) {
                                set({ currentOrganizationId: 'org-default' });
                            }
                        }).catch(err => {
                            console.error("[AuthSlice] Failed to fetch user organizations:", err);
                            // Fallback to default org if fetch fails
                            const defaultOrg = { id: 'org-default', name: 'Personal Workspace', plan: 'free' as const, members: ['me'] };
                            set({ organizations: [defaultOrg] });
                        });
                    }).catch(err => {
                        console.error("[AuthSlice] Failed to load OrganizationService:", err);
                        // Fallback to default org if service load fails
                        const defaultOrg = { id: 'org-default', name: 'Personal Workspace', plan: 'free' as const, members: ['me'] };
                        set({ organizations: [defaultOrg] });
                    });

                } else {
                    set({ user: null, isAuthenticated: false, isAuthReady: true });
                }
            });
        }).catch(error => {
            console.error("[AuthSlice] Failed to initialize Firebase Auth listener:", error);
            // Ensure we don't hang in "Loading..." state forever
            set({ isAuthReady: true, isAuthenticated: false });
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
