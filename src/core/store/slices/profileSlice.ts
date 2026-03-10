import { StateCreator } from 'zustand';
import { UserProfile, BrandKit, UserPreferences } from '@/types/User';
import { saveProfileToStorage, getProfileFromStorage } from '@/services/storage/repository';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';

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
    setOrganization: (id: string) => void;
    addOrganization: (org: Organization) => void;
    setUserProfile: (profile: UserProfile) => void;
    updateBrandKit: (updates: Partial<BrandKit>) => void;
    loadUserProfile: (uid: string) => Promise<void>;
    logout: () => Promise<void>;
    setTheme: (theme: 'dark' | 'light' | 'system') => void;
    updatePreferences: (updates: Partial<UserPreferences>) => void;
}

// Default Brand Kit — Intentionally empty so new users trigger onboarding
const DEFAULT_BRAND_KIT: BrandKit = {
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
};

const DEFAULT_USER_PROFILE: UserProfile = {
    id: 'pending',
    uid: '',
    email: '',
    displayName: 'New Artist',
    photoURL: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    lastLoginAt: Timestamp.now(),
    emailVerified: false,
    membership: { tier: 'free', expiresAt: null },
    accountType: 'artist',

    bio: '',
    preferences: {
        theme: 'system',
        notifications: true,
        observabilityEnabled: false
    },
    brandKit: DEFAULT_BRAND_KIT,
    analyzedTrackIds: [],
    knowledgeBase: [],
    savedWorkflows: [],
    careerStage: '',
    goals: []
};

export const createProfileSlice: StateCreator<ProfileSlice> = (set, get) => ({
    currentOrganizationId: 'org-default',
    organizations: [],
    userProfile: DEFAULT_USER_PROFILE,
    // Auth state delegated to AuthSlice
    setOrganization: (id) => {
        set((state) => {
            const newProfile = { ...state.userProfile, currentOrganizationId: id };
            saveProfileToStorage(newProfile).catch(err => logger.error("[ProfileSlice] Failed to save org change:", err));
            return { currentOrganizationId: id, userProfile: newProfile };
        });
    },
    addOrganization: (org) => set((state) => ({ organizations: [...state.organizations, org] })),
    setUserProfile: (profile) => {
        set({ userProfile: profile });
        // Persistence Strategy: Hybrid (IndexedDB for speed + Firestore for cloud backup)
        saveProfileToStorage(profile).catch(err => logger.error("[ProfileSlice] Failed to save profile:", err));
    },
    updateBrandKit: (updates) => set((state) => {
        const currentBrandKit = state.userProfile.brandKit || DEFAULT_BRAND_KIT;
        const newProfile = {
            ...state.userProfile,
            brandKit: { ...currentBrandKit, ...updates }
        };
        saveProfileToStorage(newProfile).catch(err => logger.error("[ProfileSlice] Failed to save profile update:", err));
        return { userProfile: newProfile };
    }),
    loadUserProfile: async (uid: string) => {
        logger.info('[Profile] Loading user profile for:', uid);

        // localStorage.getItem('currentOrgId') removed - handled in organization sync below

        try {
            // Try to get from Firestore first (via Service/Repo) 
            const profile = await getProfileFromStorage(uid);

            // --- Fetch Organizations (Fix for Permission Errors) ---
            try {
                const { db } = await import('@/services/firebase');
                const { collection, query, where, getDocs } = await import('firebase/firestore');

                const orgsRef = collection(db, 'organizations');
                const q = query(orgsRef, where('members', 'array-contains', uid));
                const orgSnap = await getDocs(q);

                const userOrgs: Organization[] = [];
                orgSnap.forEach((doc) => {
                    const data = doc.data();
                    userOrgs.push({
                        id: doc.id,
                        name: data.name || 'Untitled Org',
                        plan: data.plan || 'free',
                        members: data.members || []
                    });
                });

                if (userOrgs.length > 0) {
                    logger.info('[Profile] Loaded organizations:', userOrgs.map(o => o.id));
                    set({ organizations: userOrgs });

                    // Resolve Current Org ID
                    // Resolve Current Org ID from Cloud Profile Preference
                    const preferredOrgId = profile?.currentOrganizationId;
                    const isValidPreferred = userOrgs.find(o => o.id === preferredOrgId);

                    if (isValidPreferred) {
                        set({ currentOrganizationId: isValidPreferred.id });
                    } else {
                        // Default to the first found org and sync back to cloud if possible
                        logger.info('[Profile] Defaulting to first org:', userOrgs[0].id);
                        set({ currentOrganizationId: userOrgs[0].id });
                        if (profile && !profile.currentOrganizationId) {
                            const updatedProfile = { ...profile, currentOrganizationId: userOrgs[0].id };
                            saveProfileToStorage(updatedProfile).catch(err => logger.error("[ProfileSlice] Failed to sync default org:", err));
                        }
                    }
                }
            } catch (orgErr) {
                logger.error('[Profile] Failed to load organizations:', orgErr);
            }
            // -----------------------------------------------------

            if (profile) {
                logger.info('[Profile] Loaded profile for:', uid);
                // Ensure legacy profiles align with new schema if needed (runtime migration could go here)
                set({ userProfile: profile });
            } else {
                logger.info('[Profile] No profile found, creating default for:', uid);
                // Create a new profile for this user
                const newProfile = { ...DEFAULT_USER_PROFILE, id: uid, uid: uid };
                set({ userProfile: newProfile });
                await saveProfileToStorage(newProfile);
            }

            // Set up real-time listener for the user profile using SubscriptionManager
            try {
                const { db } = await import('@/services/firebase');
                const { doc, onSnapshot } = await import('firebase/firestore');
                const { useStore } = await import('@/core/store');

                const userRef = doc(db, 'users', uid);
                const unsubscribe = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const cloudProfile = docSnap.data() as UserProfile;
                        set({ userProfile: cloudProfile });
                    }
                }, (error) => {
                    logger.error('[Profile] Real-time listener error:', error);
                });

                useStore.getState().registerSubscription('global_profile', unsubscribe);
            } catch (err) {
                logger.error('[Profile] Failed to initialize real-time listener:', err);
            }
        } catch (err) {
            logger.error('[Profile] Failed to load profile:', err);
        }
    },
    logout: async () => {
        try {
            const { useStore } = await import('@/core/store');
            useStore.getState().clearAllSubscriptions();
        } catch (err) {
            logger.error('[Profile] Failed to clear subscriptions on logout', err);
        }
        logger.info('[System] Logout requested - resetting session state...');
        // In a no-auth world, "logout" might just reset preferences or switch to a guest profile.
        // For now, we just reload the page to clear transient state
        window.location.reload();
    },
    setTheme: (theme) => set((state) => {
        // Assume preferences is object now
        const preferences = state.userProfile.preferences || { notifications: true, theme: 'system' };

        const newProfile = {
            ...state.userProfile,
            preferences: { ...preferences, theme }
        };
        saveProfileToStorage(newProfile).catch(err => logger.error("[ProfileSlice] Failed to save theme update:", err));
        return { userProfile: newProfile };
    }),
    updatePreferences: (updates: Partial<UserPreferences>) => set((state) => {
        const currentPrefs = state.userProfile.preferences || { theme: 'system', notifications: true };
        const newProfile = {
            ...state.userProfile,
            preferences: { ...currentPrefs, ...updates }
        };
        saveProfileToStorage(newProfile).catch(err => logger.error("[ProfileSlice] Failed to save preferences:", err));
        return { userProfile: newProfile };
    })
});
