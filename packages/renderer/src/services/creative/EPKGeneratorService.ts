import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { logger } from '@/utils/logger';

export interface EPKConfig {
    projectId: string;
    userId: string;
    artistName: string;
    bio: string;
    genre: string;
    location: string;
    socialLinks: Record<string, string>;
    featuredTrackUrl: string;
    pressPhotos: string[];
    upcomingShows: Array<{
        date: string;
        venue: string;
        city: string;
    }>;
}

export interface EPKMetadata extends EPKConfig {
    id: string;
    createdAt: any;
    updatedAt: any;
}

export class EPKGeneratorService {
    /**
     * Create or update the artist's EPK configurations.
     */
    static async saveEPK(config: EPKConfig): Promise<string> {
        try {
            const existing = await this.getEPK(config.userId);
            if (existing) {
                const docRef = doc(db, 'epk_portals', existing.id);
                await updateDoc(docRef, {
                    ...config,
                    updatedAt: serverTimestamp()
                });
                logger.info(`[EPKGeneratorService] Updated EPK portal for user: ${config.userId}`);
                return existing.id;
            } else {
                const docRef = await addDoc(collection(db, 'epk_portals'), {
                    ...config,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                logger.info(`[EPKGeneratorService] Created new EPK portal: ${docRef.id}`);
                return docRef.id;
            }
        } catch (error: unknown) {
            logger.error('[EPKGeneratorService] Failed to save EPK:', error);
            throw error instanceof Error ? error : new Error('Failed to save EPK.');
        }
    }

    /**
     * Fetch the EPK configurations for a user.
     */
    static async getEPK(userId: string): Promise<EPKMetadata | null> {
        try {
            const q = query(collection(db, 'epk_portals'), where('userId', '==', userId), limit(1));
            const snap = await getDocs(q);
            if (snap.empty) return null;
            const docSnap = snap.docs[0]!;
            return { id: docSnap.id, ...docSnap.data() } as EPKMetadata;
        } catch (error: unknown) {
            logger.error('[EPKGeneratorService] Failed to fetch EPK:', error);
            return null;
        }
    }
}
