import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '@/types/User';
import { User } from 'firebase/auth';
import { BrandKit } from '@/modules/workflow/types';

// Default initial state for a new user's app profile
const INITIAL_BRAND_KIT: BrandKit = {
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
};

export class UserService {
    private static COLLECTION = 'users';

    /**
     * Create or update a user profile document from a Firebase Auth User.
     */
    static async syncUserProfile(user: User): Promise<UserProfile> {
        const userRef = doc(db, this.COLLECTION, user.uid);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
            // Update last login
            await updateDoc(userRef, {
                lastLoginAt: serverTimestamp()
            });
            return snapshot.data() as UserProfile;
        } else {
            // Create new profile with default app data
            const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email || null,
                displayName: user.displayName || 'Anonymous',
                photoURL: user.photoURL || null,
                createdAt: serverTimestamp() as Timestamp,
                updatedAt: serverTimestamp() as Timestamp,
                lastLoginAt: serverTimestamp() as Timestamp,
                emailVerified: user.emailVerified,
                membership: {
                    tier: 'free',
                    expiresAt: null
                },
                preferences: {
                    theme: 'dark',
                    notifications: true
                },
                // App Specific Defaults
                bio: '',
                brandKit: INITIAL_BRAND_KIT,
                analyzedTrackIds: [],
                knowledgeBase: [],
                savedWorkflows: [],
                careerStage: 'Emerging',
                artistType: 'Solo',
                goals: [],
                accountType: 'artist', // Default to artist for now
                socialStats: {
                    followers: 0,
                    following: 0,
                    posts: 0,
                    drops: 0
                }
            };

            await setDoc(userRef, newProfile);
            return newProfile;
        }
    }

    /**
     * Get the current user's profile.
     */
    static async getUserProfile(uid: string): Promise<UserProfile | null> {
        const userRef = doc(db, this.COLLECTION, uid);
        const snapshot = await getDoc(userRef);
        return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
    }

    /**
     * Update the current user's profile data.
     */
    static async updateProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
        const userRef = doc(db, this.COLLECTION, uid);
        // Ensure updatedAt is updated
        const updateData = {
            ...data,
            updatedAt: serverTimestamp()
        };
        await updateDoc(userRef, updateData);
    }
}
