import { StateCreator } from 'zustand';
import { UserProfile, BrandKit, UserPreferences } from '@/types/User';
import { saveProfileToStorage, getProfileFromStorage } from '@/services/storage/repository';
import { Timestamp } from 'firebase/firestore';

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

// Default Guest Profile
const DEFAULT_BRAND_KIT: BrandKit = {
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
};

const DEFAULT_USER_PROFILE: UserProfile = {
    id: 'guest',
    uid: 'guest',
    email: 'guest@indii.os',
    displayName: 'Guest Artist',
    photoURL: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    lastLoginAt: Timestamp.now(),
    emailVerified: false,
    membership: { tier: 'free', expiresAt: null },
    accountType: 'artist',

    bio: 'Creative Director',
    preferences: {
        theme: 'system',
        notifications: true
    },
    brandKit: DEFAULT_BRAND_KIT,
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
        const currentBrandKit = state.userProfile.brandKit || DEFAULT_BRAND_KIT;
        const newProfile = {
            ...state.userProfile,
            brandKit: { ...currentBrandKit, ...updates }
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
                    console.info('[Profile] Loaded organizations:', userOrgs.map(o => o.id));
                    set({ organizations: userOrgs });

                    // Resolve Current Org ID
                    const storedOrgId = localStorage.getItem('currentOrgId');
                    const isValidStored = userOrgs.find(o => o.id === storedOrgId);

                    if (isValidStored) {
                        set({ currentOrganizationId: isValidStored.id });
                    } else {
                        // Default to the first found org
                        console.info('[Profile] Defaulting to first org:', userOrgs[0].id);
                        set({ currentOrganizationId: userOrgs[0].id });
                        localStorage.setItem('currentOrgId', userOrgs[0].id);
                    }
                }
            } catch (orgErr) {
                console.error('[Profile] Failed to load organizations:', orgErr);
            }
            // -----------------------------------------------------

            if (profile) {
                console.info('[Profile] Loaded profile for:', uid);
                // Ensure legacy profiles align with new schema if needed (runtime migration could go here)
                set({ userProfile: profile });
            } else {
                console.info('[Profile] No profile found, creating default for:', uid);
                // Create a new profile for this user
                const newProfile = { ...DEFAULT_USER_PROFILE, id: uid, uid: uid };
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
        // Assume preferences is object now
        const preferences = state.userProfile.preferences || { notifications: true, theme: 'system' };

        const newProfile = {
            ...state.userProfile,
            preferences: { ...preferences, theme }
        };
        saveProfileToStorage(newProfile).catch(err => console.error("[ProfileSlice] Failed to save theme update:", err));
        return { userProfile: newProfile };
    }),
    updatePreferences: (updates: Partial<UserPreferences>) => set((state) => {
        const currentPrefs = state.userProfile.preferences || { theme: 'system', notifications: true };
        const newProfile = {
            ...state.userProfile,
            preferences: { ...currentPrefs, ...updates }
        };
        saveProfileToStorage(newProfile).catch(err => console.error("[ProfileSlice] Failed to save preferences:", err));
        return { userProfile: newProfile };
    })
});
