/**
 * Item 311: Mechanical Royalty Accounting Service
 *
 * Handles mechanical license requests for cover songs before distribution.
 * Integrates with the Harry Fox Agency / Songfile API (via Cloud Function proxy)
 * and persists license records in Firestore under `mechanical_licenses/{userId}/{licenseId}`.
 *
 * Mechanical royalties are required whenever an artist distributes a cover song
 * (a recording of a composition they did not write). The statutory rate in the US
 * (2026) is 13.1¢ per work or 2.52¢ per minute, whichever is larger, per 37 CFR §385.11.
 */

import {
    collection,
    doc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import {
    type MechanicalLicenseDocument,
    type MechanicalLicenseStatus,
} from '@/types/firestore';

// ── Types ──────────────────────────────────────────────────────────────────────

export type { MechanicalLicenseStatus };

/**
 * Composition Info for Mechanical Licensing
 */
export interface CompositionInfo {
    iswc?: string;
    title: string;
    writers: string[];
    publishers: string[];
    hfaCode?: string;
    controlled: boolean;
}

/**
 * Legacy support for the UI component
 */
export type MechanicalLicense = MechanicalLicenseDocument;

// ── Constants ─────────────────────────────────────────────────────────────────

// 2026 US statutory mechanical rates per 37 CFR §385.11
// For permanent-digital-downloads and physical: 13.1¢ per work or 2.52¢ per minute (whichever is larger)
// For streams: separate per-stream rate applies
const STATUTORY_RATE_PER_WORK_USD = 0.131;     // 13.1¢ per work minimum (2026)
const STATUTORY_RATE_PER_MINUTE_USD = 0.0252;  // 2.52¢ per minute for works over ~5 min
const COLLECTION = 'mechanical_licenses';
const CF_BASE = import.meta.env.VITE_FUNCTIONS_BASE_URL ?? '';

// ── Service ───────────────────────────────────────────────────────────────────

export const MechanicalRoyaltyService = {
    /**
     * Search the Harry Fox Agency / Songfile catalogue for a composition.
     */
    async searchComposition(trackTitle: string, writerHint?: string): Promise<CompositionInfo | null> {
        try {
            const params = new URLSearchParams({ title: trackTitle });
            if (writerHint) params.set('writer', writerHint);

            const res = await fetch(`${CF_BASE}/searchSongfile?${params.toString()}`);
            if (!res.ok) throw new Error(`Songfile search failed: ${res.status}`);
            const data = await res.json();
            return data.result as CompositionInfo;
        } catch (err: unknown) {
            logger.warn('MechanicalRoyaltyService.searchComposition: CF unavailable or failed', err);
            return null;
        }
    },

    /**
     * Create a new mechanical license record in Firestore for a cover track.
     * Uses 2026 statutory rates: 13.1¢/work or 2.52¢/min, whichever is larger.
     *
     * When searchFailed is true, status is set to 'clearance_unknown' to block
     * release until the user confirms the composition status.
     */
    async createLicense(params: {
        releaseId: string;
        trackTitle: string;
        isrc?: string;
        composition: CompositionInfo;
        distributionCopies?: number;
        durationSeconds?: number;
        searchFailed?: boolean;
    }): Promise<MechanicalLicense> {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not authenticated');

        const copies = params.distributionCopies ?? 1000;

        // Compute per-copy rate using 2026 statutory rates
        let ratePerCopy = STATUTORY_RATE_PER_WORK_USD;
        if (params.durationSeconds) {
            const minutes = Math.ceil(params.durationSeconds / 60);
            const perMinuteRate = minutes * STATUTORY_RATE_PER_MINUTE_USD;
            ratePerCopy = Math.max(STATUTORY_RATE_PER_WORK_USD, perMinuteRate);
        }

        const fee = Math.round(copies * ratePerCopy * 100) / 100;

        const licenseId = `ml_${uid}_${Date.now()}`;
        // When search failed, mark as clearance_unknown (blocking). Otherwise, use composition status.
        let status: MechanicalLicenseStatus;
        if (params.searchFailed) {
            status = 'clearance_unknown';
        } else {
            status = params.composition.controlled ? 'pending_search' : 'not_required';
        }

        const license: Omit<MechanicalLicense, 'createdAt' | 'updatedAt'> = {
            id: licenseId,
            userId: uid,
            releaseId: params.releaseId,
            trackTitle: params.trackTitle,
            isrc: params.isrc,
            composition: params.composition,
            status,
            distributionCopies: copies,
            ratePerCopy,
            totalFee: fee,
            requestedAt: Timestamp.now()
        };

        const docRef = doc(db, COLLECTION, uid, 'licenses', licenseId);
        await setDoc(docRef, {
            ...license,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        logger.info('MechanicalRoyaltyService: License record created', { licenseId });
        return {
            ...license,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        } as MechanicalLicense;
    },

    /**
     * Submit a license request to HFA/Songfile via Cloud Function proxy.
     */
    async requestLicense(licenseId: string): Promise<void> {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not authenticated');

        try {
            const res = await fetch(`${CF_BASE}/requestMechanicalLicense`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseId, userId: uid }),
            });

            if (!res.ok) throw new Error(`License request failed: ${res.status}`);
            const data = await res.json();
            const result = data.result;

            const docRef = doc(db, COLLECTION, uid, 'licenses', licenseId);
            await updateDoc(docRef, {
                status: 'license_requested',
                licenseNumber: result?.licenseNumber,
                requestedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            logger.info('MechanicalRoyaltyService: License requested', { licenseId, licenseNumber: result?.licenseNumber });
        } catch (err: unknown) {
            logger.error('MechanicalRoyaltyService.requestLicense failed', err);
            throw err;
        }
    },

    /**
     * Fetch all mechanical licenses for the current user, optionally filtered by releaseId.
     * Returns error signal (null) if auth fails or Firestore is unavailable (fail-closed).
     */
    async getLicenses(releaseId?: string): Promise<MechanicalLicense[] | null> {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            logger.warn('MechanicalRoyaltyService.getLicenses: user not authenticated; returning null to block distribution');
            return null;
        }

        try {
            const col = collection(db, COLLECTION, uid, 'licenses');
            const q = releaseId ? query(col, where('releaseId', '==', releaseId)) : query(col);
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as MechanicalLicense));
        } catch (err: unknown) {
            logger.error('MechanicalRoyaltyService.getLicenses failed (Firestore unavailable)', err);
            return null;
        }
    },

    /**
     * Check if all cover tracks in a release have active or not-required licenses.
     * Returns 'unknown' if licenses cannot be fetched (auth failure / Firestore unavailable).
     * Only returns 'cleared' if explicitly approved or not applicable, NEVER if undetermined.
     */
    async isReleaseClearedForDistribution(releaseId: string): Promise<{
        status: 'cleared' | 'pending' | 'unknown';
        pendingTracks: string[];
    }> {
        const licenses = await this.getLicenses(releaseId);

        if (licenses === null) {
            logger.error('MechanicalRoyaltyService: Cannot determine clearance; failing closed', { releaseId });
            return {
                status: 'unknown',
                pendingTracks: [],
            };
        }

        const pending = licenses.filter(
            l => l.status !== 'license_active' && l.status !== 'not_required'
        );

        return {
            status: pending.length === 0 ? 'cleared' : 'pending',
            pendingTracks: pending.map(l => l.trackTitle),
        };
    },

    /** Compute the total mechanical royalty fee for a set of licenses. */
    computeTotalFee(licenses: MechanicalLicense[]): number {
        const totalCents = licenses
            .filter(l => l.status !== 'not_required')
            .reduce((sum, l) => sum + Math.round(l.totalFee * 100), 0);
        return totalCents / 100;
    },
};
