import { db } from '../firebase';
import { logger } from '@/utils/logger';

import { FirestoreService } from '../FirestoreService';
import { License, LicenseRequest } from './types';
import { query, where, orderBy, limit, Unsubscribe, collection, getDocs } from 'firebase/firestore';
import { useStore } from '@/core/store';
import { createOneTimePayment } from '@/services/payment/PaymentService';

// ── Types for SyncBriefMatcher ────────────────────────────────────────────────

export type SyncMood = 'Cinematic' | 'Upbeat' | 'Melancholic' | 'Dark' | 'Chill' | 'Energetic' | 'Romantic' | 'Triumphant';

export interface SyncCatalogTrack {
    id: string;
    title: string;
    bpm: number;
    moods: SyncMood[];
    duration: string;
    isrc: string;
}

export interface SyncBrief {
    id: string;
    project: string;
    type: 'TV' | 'Film' | 'Ad' | 'Game' | 'Trailer';
    network: string;
    deadline: string;
    bpmMin: number;
    bpmMax: number;
    moods: SyncMood[];
    budget: string;
    description: string;
}

export class LicensingService {
    private licensesStore = new FirestoreService<License>('licenses');
    private requestsStore = new FirestoreService<LicenseRequest>('license_requests');

    /**
     * Get active licenses for the current project.
     * Note: In a real project-scoped app, we would filter by projectId.
     */
    /**
     * Get active licenses for the current project.
     */
    async getActiveLicenses(userId?: string): Promise<License[]> {
        const constraints = [
            where('status', '==', 'active'),
            orderBy('updatedAt', 'desc')
        ];

        if (userId) {
            constraints.push(where('userId', '==', userId));
        }

        const results = await this.licensesStore.list(constraints);

        if (results.length === 0 && userId) {
            await this.seedDatabase(userId);
            // After seeding, fetch again once to check if seeding populated anything
            return this.licensesStore.list(constraints);
        }

        return results;
    }

    /**
     * Get pending license requests.
     */
    async getPendingRequests(userId?: string): Promise<LicenseRequest[]> {
        const constraints = [
            where('status', 'in', ['checking', 'pending_approval', 'negotiating']),
            orderBy('updatedAt', 'desc')
        ];

        if (userId) {
            constraints.push(where('userId', '==', userId));
        }

        return this.requestsStore.list(constraints);
    }

    /**
     * Calculate projected portfolio value based on active signed licenses and evidence-backed terms.
     * Sums actual agreement fees.
     */
    async getProjectedValue(userId?: string): Promise<number> {
        const active = await this.getActiveLicenses(userId);
        if (active.length === 0) return 0;

        return active.reduce((total, lic) => {
            const fee = typeof lic.feeUsd === 'number' && !isNaN(lic.feeUsd) ? lic.feeUsd : 0;
            return total + fee;
        }, 0);
    }

    /**
     * Create a new license.
     */
    async createLicense(license: Omit<License, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        return this.licensesStore.add(license as unknown as License);
    }

    /**
     * Create a new license request.
     */
    async createRequest(request: Omit<LicenseRequest, 'id' | 'requestedAt' | 'updatedAt'>): Promise<string> {
        // We cast to any to satisfy the store's simplified generic constraints
        // while maintaining internal type safety from the method signature.
        // Fixing the strict type chain for Omit<T, K> -> Partial<T> is out of scope for this hotfix.
        return this.requestsStore.add({
            ...request,
            status: request.status || 'checking'
        } as unknown as LicenseRequest);
    }

    /**
     * Initiate a license purchase checkout session.
     */
    async initiateLicensePurchase(params: {
        userId: string;
        trackTitle: string;
        artist: string;
        price: number; // in cents
        connectedAccountId: string;
        metadata?: Record<string, string>;
    }): Promise<string> {
        const { userId, trackTitle, artist, price, connectedAccountId, metadata } = params;

        return createOneTimePayment({
            userId,
            items: [{
                name: `Sync License - ${trackTitle}`,
                description: `Sync license agreement for ${trackTitle} by ${artist}`,
                amount: price,
                quantity: 1,
            }],
            applySurcharge: true,
            metadata: {
                type: 'licensing_purchase',
                trackTitle,
                artist,
                connectedAccountId,
                artistAmount: String(price),
                ...metadata,
            }
        });
    }

    /**
     * Update an existing request.
     */
    async updateRequest(id: string, data: Partial<LicenseRequest>): Promise<void> {
        return this.requestsStore.update(id, data);
    }

    /**
     * Convenience method to update set status.
     */
    async updateRequestStatus(id: string, status: LicenseRequest['status']): Promise<void> {
        return this.updateRequest(id, { status });
    }

    /**
     * Subscribe to real-time active licenses.
     */
    subscribeToActiveLicenses(callback: (licenses: License[]) => void, userId?: string, onError?: (error: Error) => void): Unsubscribe {
        const constraints = [where('status', '==', 'active')];
        if (userId) {
            constraints.push(where('userId', '==', userId));
        }

        return this.licensesStore.subscribe(constraints, (data) => {
            // Client-side sort to avoid index requirements
            const sorted = data.sort((a, b) => {
                const dateA = a.updatedAt?.toMillis() || 0;
                const dateB = b.updatedAt?.toMillis() || 0;
                return dateB - dateA;
            });
            callback(sorted);
        }, onError);
    }

    /**
     * Subscribe to real-time pending requests.
     */
    subscribeToPendingRequests(callback: (requests: LicenseRequest[]) => void, userId?: string, onError?: (error: Error) => void): Unsubscribe {
        const constraints = [where('status', 'in', ['checking', 'pending_approval', 'negotiating'])];
        if (userId) {
            constraints.push(where('userId', '==', userId));
        }

        return this.requestsStore.subscribe(constraints, (data) => {
            // Client-side sort to avoid index requirements
            const sorted = data.sort((a, b) => {
                const dateA = a.updatedAt?.toMillis() || 0;
                const dateB = b.updatedAt?.toMillis() || 0;
                return dateB - dateA;
            });
            callback(sorted);
        }, onError);
    }

    /**
     * Seed initial data for a new user/org
     */
    private async seedDatabase(userId: string) {
        // No-op: Licensing data is created by user actions, not auto-seeded
        logger.info(`[LicensingService] Database ready for ${userId}.`);
    }

    // ── Sync Brief Matcher ──────────────────────────────────────────────────

    /**
     * Returns the user's catalog tracks mapped to the SyncCatalogTrack shape.
     * Reads from `proprietaryIngestionReleases` and picks up BPM from `audioFeatures.bpm`
     * if stored on the document (set by AudioAnalysisService after upload).
     */
    async getCatalogTracksForSync(): Promise<SyncCatalogTrack[]> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        try {
            const snapshot = await getDocs(
                query(collection(db, 'proprietaryIngestionReleases'), where('orgId', '==', userProfile.id), limit(50))
            );

            return snapshot.docs.map(d => {
                const data = d.data();
                const meta = data.metadata ?? {};
                const audioFeatures = data.audioFeatures ?? {};
                const moods = (meta.mood ?? []) as SyncMood[];
                const bpm = Math.round(audioFeatures.bpm ?? meta.bpm ?? 0);
                const duration = meta.durationFormatted ?? (meta.durationSeconds ? `${Math.floor(meta.durationSeconds / 60)}:${String(meta.durationSeconds % 60).padStart(2, '0')}` : '—');

                return {
                    id: d.id,
                    title: meta.title ?? data.title ?? 'Untitled',
                    bpm,
                    moods,
                    duration,
                    isrc: meta.isrc ?? data.isrc ?? '',
                } satisfies SyncCatalogTrack;
            });
        } catch (err: unknown) {
            logger.warn('[LicensingService] getCatalogTracksForSync failed:', err);
            return [];
        }
    }

    /**
     * Returns sync briefs from Firestore.
     * If the collection is empty, return an honest empty list instead of inventing opportunities.
     */
    async getSyncBriefs(): Promise<SyncBrief[]> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        try {
            const col = collection(db, 'users', userProfile.id, 'syncBriefs');
            const snapshot = await getDocs(query(col, orderBy('deadline', 'asc'), limit(30)));

            if (!snapshot.empty) {
                return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SyncBrief));
            }

            return [];
        } catch (err: unknown) {
            logger.warn('[LicensingService] getSyncBriefs failed:', err);
            return [];
        }
    }
}

export const licensingService = new LicensingService();
