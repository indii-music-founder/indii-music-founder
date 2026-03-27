import { Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '@/utils/logger';

import { FirestoreService } from '../FirestoreService';
import { License, LicenseRequest } from './types';
import { query, where, orderBy, limit, Unsubscribe, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useStore } from '@/core/store';

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
            // After seeding, fetch again with the same credentials
            return this.getActiveLicenses(userId);
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
     * Calculate projected portfolio value based on active licenses.
     * In production, this would use a more complex actuarial model.
     */
    async getProjectedValue(userId?: string): Promise<number> {
        const active = await this.getActiveLicenses(userId);
        // Base valuation: Each active license contributes a standard projected market value
        // plus potential performance multipliers. For now, we use a conservative $12,500 base.
        const baseValue = 12500;
        return active.length * baseValue;
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
     * Reads from `ddexReleases` and picks up BPM from `audioFeatures.bpm`
     * if stored on the document (set by AudioAnalysisService after upload).
     */
    async getCatalogTracksForSync(): Promise<SyncCatalogTrack[]> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        try {
            const snapshot = await getDocs(
                query(collection(db, 'ddexReleases'), where('orgId', '==', userProfile.id), limit(50))
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
        } catch (err) {
            logger.warn('[LicensingService] getCatalogTracksForSync failed:', err);
            return [];
        }
    }

    /**
     * Returns sync briefs from Firestore. If the collection is empty, generates
     * realistic sample briefs with GenAI and caches them in Firestore so future
     * sessions load instantly.
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

            // Collection empty → generate and seed with AI
            return this.seedSyncBriefs(userProfile.id);
        } catch (err) {
            logger.warn('[LicensingService] getSyncBriefs failed:', err);
            return [];
        }
    }

    /**
     * Uses GenAI to generate realistic sync licensing briefs and writes them
     * to Firestore so they survive page refreshes.
     */
    private async seedSyncBriefs(userId: string): Promise<SyncBrief[]> {
        try {
            const { GenAI } = await import('@/services/ai/GenAI');
            const { AI_MODELS } = await import('@/core/config/ai-models');

            const today = new Date();
            const deadlines = [7, 14, 21, 30, 45, 60, 90].map(d => {
                const dt = new Date(today);
                dt.setDate(dt.getDate() + d);
                return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            });

            const schema = {
                type: 'OBJECT',
                properties: {
                    briefs: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                project: { type: 'STRING' },
                                type: { type: 'STRING', enum: ['TV', 'Film', 'Ad', 'Game', 'Trailer'] },
                                network: { type: 'STRING' },
                                deadline: { type: 'STRING' },
                                bpmMin: { type: 'NUMBER' },
                                bpmMax: { type: 'NUMBER' },
                                moods: { type: 'ARRAY', items: { type: 'STRING', enum: ['Cinematic', 'Upbeat', 'Melancholic', 'Dark', 'Chill', 'Energetic', 'Romantic', 'Triumphant'] } },
                                budget: { type: 'STRING' },
                                description: { type: 'STRING' },
                            }
                        }
                    }
                }
            };

            const generated = await GenAI.generateStructuredData<{ briefs: Omit<SyncBrief, 'id'>[] }>(
                `Generate 8 realistic sync licensing briefs for music supervisors seeking independent music.
Use these upcoming deadlines: ${deadlines.join(', ')}.
Vary the types (TV, Film, Ad, Game, Trailer), budgets ($5K–$100K+), moods and BPM ranges.
Make each brief feel authentic with real-sounding network names and project titles.`,
                schema as Record<string, unknown>,
                undefined,
                'You are a sync licensing coordinator generating a daily brief digest for indie artists.'
            );

            const col = collection(db, 'users', userId, 'syncBriefs');
            const briefs: SyncBrief[] = [];

            for (const brief of generated.briefs ?? []) {
                const docRef = await addDoc(col, { ...brief, createdAt: serverTimestamp() });
                briefs.push({ id: docRef.id, ...brief });
            }

            logger.info(`[LicensingService] Seeded ${briefs.length} sync briefs for ${userId}`);
            return briefs;
        } catch (err) {
            logger.warn('[LicensingService] seedSyncBriefs failed:', err);
            return [];
        }
    }
}

export const licensingService = new LicensingService();
