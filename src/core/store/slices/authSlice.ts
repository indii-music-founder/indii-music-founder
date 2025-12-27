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

        // Listen for Electron IPC auth callbacks (deep link returns)
        const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;
        console.log('[AuthSlice] Checking for electronAPI:', !!electronAPI);

        if (electronAPI?.auth?.onUserUpdate) {
            console.log('[AuthSlice] Setting up Electron IPC auth listener');
            electronAPI.auth.onUserUpdate(async (tokenData: { idToken: string; accessToken?: string | null } | null) => {
                console.log('[AuthSlice] Electron onUserUpdate callback triggered', !!tokenData);

                if (tokenData?.idToken) {
                    console.log('[AuthSlice] Received tokens from Electron deep link');
                    console.log(`[AuthSlice] Token details - ID Token Length: ${tokenData.idToken.length}, Access Token Length: ${tokenData.accessToken?.length || 0}`);

                    try {
                        const { auth } = await import('@/services/firebase');
                        console.log('[AuthSlice] Initializing Google Credential with tokens...');
                        const { signInWithCredential, GoogleAuthProvider } = await import('firebase/auth');

                        // First attempt: ID Token + Access Token (if available)
                        try {
                            console.log('[AuthSlice] Attempting sign-in with ID Token + Access Token...');
                            const credential = GoogleAuthProvider.credential(tokenData.idToken, tokenData.accessToken);
                            const result = await signInWithCredential(auth, credential);
                            console.log('[AuthSlice] Deep link sign-in success (Method: ID+Access):', result.user.uid);
                        } catch (primaryError: any) {
                            console.error('[AuthSlice] Primary sign-in attempt failed:', primaryError.code, primaryError.message);

                            // If we have an access token and failed, try again with JUST the ID token
                            if (tokenData.accessToken) {
                                console.warn('[AuthSlice] Sign-in with Access Token failed. Retrying with ID Token only...');
                                try {
                                    const credentialRetry = GoogleAuthProvider.credential(tokenData.idToken);
                                    const resultRetry = await signInWithCredential(auth, credentialRetry);
                                    console.log('[AuthSlice] Deep link sign-in success (Method: ID Only):', resultRetry.user.uid);
                                } catch (retryError: any) {
                                    console.error('[AuthSlice] Retry sign-in failed as well:', retryError.code, retryError.message);
                                    throw retryError;
                                }
                            } else {
                                throw primaryError; // Re-throw if no fallback possible
                            }
                        }

                        // onAuthStateChanged will handle the rest
                    } catch (error: any) {
                        console.error('[AuthSlice] Failed to sign in with Electron tokens (All attempts):', error.code, error.message);
                        // Optional: Could expose this error to the UI via state if needed
                    }
                } else if (tokenData === null) {
                    console.log('[AuthSlice] Electron logout signal received via IPC');
                    // Logout handled by Firebase onAuthStateChanged
                } else {
                    console.warn('[AuthSlice] Received incomplete token data from Electron:', tokenData);
                }
            });
        } else {
            if (typeof window !== 'undefined' && (window as any).process?.versions?.electron) {
                console.error('[AuthSlice] ERROR: Running in Electron but electronAPI.auth.onUserUpdate is missing!');
            }
        }

        // Listen for Auth Changes
        import('@/services/firebase').then(async ({ auth }) => {
            const { onAuthStateChanged } = await import('firebase/auth');

            // Bypass for E2E Tests
            // @ts-expect-error test mode flag
            const isTestMode = window.__TEST_MODE__ || localStorage.getItem('TEST_MODE') === 'true';
            console.log('[AuthSlice] Checking Test Mode:', isTestMode);
            if (isTestMode) {
                console.log("[AuthSlice] Test Mode detected - skipping Firebase Auth listener");
                return;
            }

            onAuthStateChanged(auth, async (user: User | null) => {
                console.log("[AuthSlice] Auth State Changed:", user ? `User ${user.uid} (Anon: ${user.isAnonymous})` : 'Logged Out');
                if (user) {
                    // ALLOW ANONYMOUS ACCESS
                    // We treat anonymous users as authenticated for the purpose of app access
                    // Specific modules can check user.isAnonymous if they need to restrict features
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
