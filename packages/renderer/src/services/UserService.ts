import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '@/types/User';
import { BrandKit } from '@/modules/workflow/types';
import { SocialStats } from '@/services/social/types';
import { logger } from '@/utils/logger';

// Default initial state for a new user's app profile
const _INITIAL_BRAND_KIT: BrandKit = {
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
    private static PUBLIC_COLLECTION = 'public_profiles';

    /**
     * Get a user's public profile projection (for peer discovery, profile headers, and social views).
     * Does not expose private billing or identity fields.
     */
    static async getPublicProfile(uid: string): Promise<UserProfile | null> {
        try {
            const publicRef = doc(db, this.PUBLIC_COLLECTION, uid);
            const publicSnap = await getDoc(publicRef);

            // Fetch public social stats
            let socialStats: SocialStats = { followers: 0, following: 0, posts: 0, drops: 0 };
            try {
                const statsRef = doc(db, 'social_stats', uid);
                const statsSnap = await getDoc(statsRef);
                if (statsSnap.exists()) {
                    const sData = statsSnap.data();
                    socialStats = {
                        followers: typeof sData.followers === 'number' ? sData.followers : 0,
                        following: typeof sData.following === 'number' ? sData.following : 0,
                        posts: typeof sData.posts === 'number' ? sData.posts : 0,
                        drops: typeof sData.drops === 'number' ? sData.drops : 0,
                    };
                }
            } catch {
                // Non-critical if social stats cannot be read
            }

            if (publicSnap.exists()) {
                const data = publicSnap.data();
                return {
                    id: uid,
                    uid,
                    displayName: (data.displayName as string) || null,
                    photoURL: (data.photoURL as string) || null,
                    bio: (data.bio as string) || '',
                    brandKit: data.brandKit as BrandKit | undefined,
                    accountType: (data.accountType as 'artist' | 'fan' | 'label' | 'admin') || 'fan',
                    artistType: data.artistType as 'Solo' | 'Band' | 'Collective' | undefined,
                    location: data.location as string | undefined,
                    socialStats,
                } as unknown as UserProfile;
            }

            // If public_profile document does not exist yet, return minimal public profile projection
            return {
                id: uid,
                uid,
                displayName: null,
                photoURL: null,
                bio: '',
                accountType: 'fan',
                socialStats,
            } as unknown as UserProfile;
        } catch (error) {
            logger.error('Failed to get public profile', error);
            return null;
        }
    }

    /**
     * Get the current user's profile.
     * If reading private users/{uid} is denied (e.g. for peer user profiles),
     * automatically falls back to getPublicProfile.
     */
    static async getUserProfile(uid: string): Promise<UserProfile | null> {
        try {
            const userRef = doc(db, this.COLLECTION, uid);
            const snapshot = await getDoc(userRef);
            return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
        } catch (error: any) {
            if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
                return this.getPublicProfile(uid);
            }
            throw error;
        }
    }

    /**
     * Update the current user's profile data and project public fields to public_profiles.
     */
    static async updateProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
        const userRef = doc(db, this.COLLECTION, uid);
        const updateData = {
            ...data,
            updatedAt: serverTimestamp()
        };
        await updateDoc(userRef, updateData);

        // Project public fields into public_profiles collection
        try {
            const publicData: Record<string, unknown> = {
                id: uid,
                uid,
                userId: uid,
                updatedAt: serverTimestamp(),
            };
            if (data.displayName !== undefined) publicData.displayName = data.displayName;
            if (data.photoURL !== undefined) publicData.photoURL = data.photoURL;
            if (data.bio !== undefined) publicData.bio = data.bio;
            if (data.brandKit !== undefined) publicData.brandKit = data.brandKit;
            if (data.accountType !== undefined) publicData.accountType = data.accountType;
            if (data.artistType !== undefined) publicData.artistType = data.artistType;
            if (data.location !== undefined) publicData.location = data.location;

            const publicRef = doc(db, this.PUBLIC_COLLECTION, uid);
            await setDoc(publicRef, publicData, { merge: true });
        } catch (error) {
            logger.warn('Failed to sync public profile projection', error);
        }
    }
}
