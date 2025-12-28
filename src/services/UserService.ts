import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '@/types/User';
// import { User } from 'firebase/auth'; // REMOVED
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
    // syncUserProfile removed - Legacy Auth


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
