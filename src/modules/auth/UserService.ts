import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, updateDoc, Timestamp, SetOptions } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { BrandKit } from '../workflow/types'; // Import BrandKit type

// Extend the interface to match what the app expects
export interface FirestoreUserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string | null;
    createdAt: Timestamp;
    lastLoginAt: Timestamp;
    tier: 'free' | 'pro' | 'enterprise';
    brandKit?: BrandKit;
    bio?: string;
    preferences?: any;
    analyzedTrackIds?: string[];
    knowledgeBase?: any[];
    savedWorkflows?: any[];
    careerStage?: string;
    goals?: string[];
}

export const UserService = {
    async getUserProfile(uid: string): Promise<FirestoreUserProfile | null> {
        const userRef = doc(db, 'users', uid);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
            return snapshot.data() as FirestoreUserProfile;
        }
        return null;
    },

    /**
     * Syncs the Firebase Auth user with the Firestore User Profile.
     * Creates the profile if it doesn't exist.
     * Returns the full profile.
     */
    async syncUserProfile(user: User): Promise<FirestoreUserProfile> {
        const userRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(userRef);

        if (!snapshot.exists()) {
            // Create new profile with defaults
            const newProfile: FirestoreUserProfile = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'Anonymous',
                photoURL: user.photoURL || null,
                createdAt: Timestamp.now(),
                lastLoginAt: Timestamp.now(),
                tier: 'free',
                // Initialize empty containers for app state
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
                }
            };
            await setDoc(userRef, newProfile);
            return newProfile;
        }

        // Update login time
        await updateDoc(userRef, { lastLoginAt: Timestamp.now() });
        return snapshot.data() as FirestoreUserProfile;
    },

    async updateProfile(uid: string, data: Partial<FirestoreUserProfile>) {
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, data, { merge: true });
    },

    async updateUserTier(uid: string, tier: 'free' | 'pro' | 'enterprise') {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { tier });
    }
};
