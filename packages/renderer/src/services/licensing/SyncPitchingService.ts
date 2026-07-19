import { db } from '../firebase';
import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    increment,
    Timestamp
} from 'firebase/firestore';

export interface SyncPitch {
    id?: string;
    briefId: string;
    trackIds: string[];
    status: 'pitched' | 'under_review' | 'shortlisted' | 'licensed' | 'declined';
    supervisorEmail?: string;
    message?: string;
    pitchedAt: Timestamp | string;
    updatedAt: Timestamp | string;
}

export interface SupervisorPortal {
    id?: string;
    title: string;
    trackIds: string[];
    passwordProtected: boolean;
    hashedPassword?: string;
    allowDownloads: boolean;
    expiresAt?: string;
    analytics: {
        viewsCount: number;
        playbacksCount: Record<string, number>;
        downloadsCount: Record<string, number>;
    };
    createdAt: Timestamp | string;
}

export class SyncPitchingService {
    /**
     * Create a pitch linked to a specific sync brief
     */
    async createPitch(pitch: Omit<SyncPitch, 'pitchedAt' | 'updatedAt' | 'status'>): Promise<string> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) {
            throw new Error('User not authenticated');
        }

        const col = collection(db, 'users', userProfile.id, 'sync_pitches');
        const docRef = await addDoc(col, {
            ...pitch,
            status: 'pitched',
            pitchedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        logger.info(`[SyncPitchingService] Created pitch ${docRef.id} for brief ${pitch.briefId}`);
        return docRef.id;
    }

    /**
     * Get pitches for a user
     */
    async getPitches(): Promise<SyncPitch[]> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        const col = collection(db, 'users', userProfile.id, 'sync_pitches');
        const q = query(col, orderBy('pitchedAt', 'desc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SyncPitch));
    }

    /**
     * Create a curated Supervisor Portal (landing page/link)
     */
    async createSupervisorPortal(portal: Omit<SupervisorPortal, 'analytics' | 'createdAt'>): Promise<string> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) {
            throw new Error('User not authenticated');
        }

        const col = collection(db, 'users', userProfile.id, 'supervisor_portals');
        const docRef = await addDoc(col, {
            ...portal,
            analytics: {
                viewsCount: 0,
                playbacksCount: {},
                downloadsCount: {}
            },
            createdAt: serverTimestamp()
        });

        logger.info(`[SyncPitchingService] Created supervisor portal ${docRef.id}: ${portal.title}`);
        return docRef.id;
    }

    /**
     * Retrieve a supervisor portal configuration by user ID and portal ID
     */
    async getSupervisorPortal(userId: string, portalId: string): Promise<SupervisorPortal | null> {
        const docRef = doc(db, 'users', userId, 'supervisor_portals', portalId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            return null;
        }

        return { id: snap.id, ...snap.data() } as SupervisorPortal;
    }

    /**
     * Track interaction analytics on a supervisor portal
     */
    async trackPortalInteraction(
        userId: string,
        portalId: string,
        interactionType: 'view' | 'play' | 'download',
        trackId?: string
    ): Promise<void> {
        const docRef = doc(db, 'users', userId, 'supervisor_portals', portalId);

        try {
            if (interactionType === 'view') {
                await updateDoc(docRef, {
                    'analytics.viewsCount': increment(1)
                });
            } else if (interactionType === 'play' && trackId) {
                await updateDoc(docRef, {
                    [`analytics.playbacksCount.${trackId}`]: increment(1)
                });
            } else if (interactionType === 'download' && trackId) {
                await updateDoc(docRef, {
                    [`analytics.downloadsCount.${trackId}`]: increment(1)
                });
            }
        } catch (err: unknown) {
            logger.warn(`[SyncPitchingService] Failed to update portal analytics:`, err);
        }
    }
}

export const syncPitchingService = new SyncPitchingService();
