import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserContext } from '../types/User';
import { User } from 'firebase/auth';
import { UserProfile as AppUserProfile } from '../modules/workflow/types';

// Default initial state for a new user's app profile
const INITIAL_APP_PROFILE: AppUserProfile = {
    bio: '',
    preferences: '{}',
    brandKit: {
        colors: [],
        fonts: 'Inter',
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
};

export class UserService {
    private static COLLECTION = 'users';

    /**
     * Create or update a user profile document from a Firebase Auth User.
     */
    static async syncUserProfile(user: User): Promise<UserContext> {
        const userRef = doc(db, this.COLLECTION, user.uid);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
            // Update last login
            await updateDoc(userRef, {
                lastLoginAt: serverTimestamp()
            });
            return snapshot.data() as UserContext;
        } else {
            // Create new profile with default app data
            const newProfile: UserContext = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'Anonymous',
                photoURL: user.photoURL || null,
                createdAt: serverTimestamp() as Timestamp,
                lastLoginAt: serverTimestamp() as Timestamp,
                tier: 'free',
                ...INITIAL_APP_PROFILE,
                preferences: {} // Override string to object if needed for context, or keep string
            };

            // Cast to any for Firestore if types don't match perfectly
            await setDoc(userRef, newProfile);
            return newProfile;
        }
    }

    /**
     * Get the current user's profile.
     */
    static async getUserProfile(uid: string): Promise<UserContext | null> {
        const userRef = doc(db, this.COLLECTION, uid);
        const snapshot = await getDoc(userRef);
        return snapshot.exists() ? (snapshot.data() as UserContext) : null;
    }

    /**
     * Update the current user's profile data.
     */
    static async updateProfile(uid: string, data: Partial<UserContext>): Promise<void> {
        const userRef = doc(db, this.COLLECTION, uid);
        await updateDoc(userRef, data);
    }
}
