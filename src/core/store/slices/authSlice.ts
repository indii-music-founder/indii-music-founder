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
        set({ userProfile: profile });

        // Sync to Firestore if logged in
        const user = get().user;
        if (user) {
            import('@/services/UserService').then(({ UserService }) => {
                UserService.updateProfile(user.uid, {
                    bio: profile.bio,
                    preferences: profile.preferences,
                    creativePreferences: profile.creativePreferences,
                    brandKit: profile.brandKit,
                    knowledgeBase: profile.knowledgeBase,
                    careerStage: profile.careerStage,
                    goals: profile.goals
                });
            });
        }
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

        // Firebase Auth initialization
        import('@/services/firebase').then(async ({ auth }) => {
            const { onAuthStateChanged } = await import('firebase/auth');

            // Bypass for E2E Tests/Unit Tests
            // @ts-expect-error test mode flag
            const isAuthDisabled = (window.__DISABLE_AUTH__ || localStorage.getItem('DISABLE_AUTH') === 'true');
            if (isAuthDisabled) {
                console.log("[AuthSlice] Auth Disabled - skipping");
                set({ isAuthReady: true });
                return;
            }

            // CRITICAL: Check for Google redirect result FIRST
            // This catches the user returning from Google OAuth
            try {
                const { AuthService } = await import('@/services/AuthService');
                await AuthService.handleRedirectResult();
            } catch (err) {
                console.error("[AuthSlice] Redirect result error:", err);
            }

            // Then listen for auth state changes
            // Note: On redirect return, profile syncs twice (in handleRedirectResult and here).
            // This is harmless (just updates lastLoginAt) - keeping simple over optimized.
            onAuthStateChanged(auth, async (user: User | null) => {
                console.log("[AuthSlice] Auth State Changed:", user ? `User ${user.uid} (Anon: ${user.isAnonymous})` : 'Logged Out');
                if (user) {
                    const isAuthenticated = !!user;
                    set({ user, isAuthenticated, isAuthReady: true });

                    // Sync User Profile from Firestore
                    import('@/services/UserService').then(({ UserService }) => {
                        UserService.syncUserProfile(user).then((fullProfile) => {
                            const appProfile: UserProfile = {
                                ...fullProfile, // Spread common fields
                                id: user.uid, // Populate ID from auth user
                                bio: fullProfile.bio || '',
                                // Clean up preferences mapping
                                preferences: fullProfile.preferences || {},
                                creativePreferences: fullProfile.creativePreferences || '',
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
                                savedWorkflows: fullProfile.savedWorkflows || [],
                                careerStage: fullProfile.careerStage || 'Emerging',
                                goals: fullProfile.goals || []
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
        const { AuthService } = await import('@/services/AuthService');
        await AuthService.signOut();
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
