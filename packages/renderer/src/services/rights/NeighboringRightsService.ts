import { db } from '../firebase';
import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';
import {
    collection,
    doc,
    addDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';

export interface NeighboringRightsContributor {
    name: string;
    role: 'Featured Artist' | 'Non-Featured Performer' | 'Session Musician';
    sharePercentage: number;
    ipnCode?: string;
}

export interface NeighboringRightsRegistration {
    id?: string;
    isrc: string;
    trackTitle: string;
    organization: 'SoundExchange' | 'PPL' | 'GVL' | 'ADAMI';
    registrationType: 'rights_holder' | 'performer' | 'both';
    contributors: NeighboringRightsContributor[];
    status: 'pending_submission' | 'submitted' | 'registered' | 'requires_action';
    submittedAt?: Timestamp;
    registeredAt?: Timestamp;
    errors?: string;
    createdAt?: Timestamp;
}

export class NeighboringRightsService {
    /**
     * Compute standard performer shares based on role categories
     * Industry Standard split:
     * - 50% to Rights Owner (Master)
     * - 45% to Featured Artist
     * - 5% to Non-Featured Performer / Session Musicians (split equally among them)
     */
    calculateStandardShares(contributors: Omit<NeighboringRightsContributor, 'sharePercentage'>[]): NeighboringRightsContributor[] {
        const featured = contributors.filter(c => c.role === 'Featured Artist');
        const nonFeatured = contributors.filter(c => c.role === 'Non-Featured Performer' || c.role === 'Session Musician');

        const result: NeighboringRightsContributor[] = [];

        // Distribute 45% to featured artists equally
        if (featured.length > 0) {
            const featuredShare = 45 / featured.length;
            featured.forEach(f => {
                result.push({ ...f, sharePercentage: featuredShare });
            });
        }

        // Distribute 5% to non-featured performers equally
        if (nonFeatured.length > 0) {
            const nonFeaturedShare = 5 / nonFeatured.length;
            nonFeatured.forEach(nf => {
                result.push({ ...nf, sharePercentage: nonFeaturedShare });
            });
        }

        return result;
    }

    /**
     * Register Neighboring Rights
     */
    async registerNeighboringRights(registration: Omit<NeighboringRightsRegistration, 'status' | 'createdAt'>): Promise<string> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) {
            throw new Error('User not authenticated');
        }

        const col = collection(db, 'users', userProfile.id, 'neighboring_rights_registrations');
        const docRef = await addDoc(col, {
            ...registration,
            status: 'pending_submission',
            createdAt: serverTimestamp()
        });

        logger.info(`[NeighboringRightsService] Initiated registration ${docRef.id} for track ${registration.trackTitle}`);
        return docRef.id;
    }

    /**
     * Fetch all neighboring rights registrations for the user
     */
    async getRegistrations(): Promise<NeighboringRightsRegistration[]> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        const col = collection(db, 'users', userProfile.id, 'neighboring_rights_registrations');
        const q = query(col, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NeighboringRightsRegistration));
    }
}

export const neighboringRightsService = new NeighboringRightsService();
