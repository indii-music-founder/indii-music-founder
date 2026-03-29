/**
 * Item 311: Mechanical Royalty Accounting Service
 *
 * Handles mechanical license requests for cover songs before distribution.
 * Integrates with the Harry Fox Agency / Songfile API (via Cloud Function proxy)
 * and persists license records in Firestore under `mechanical_licenses/{userId}/{licenseId}`.
 *
 * Mechanical royalties are required whenever an artist distributes a cover song
 * (a recording of a composition they did not write). The statutory rate in the US
 * is 9.1¢ per copy for songs ≤ 5 minutes.
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

const STATUTORY_RATE_USD = 0.091;   // 2024 US statutory mechanical rate (≤ 5 min)
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
     */
    async createLicense(params: {
        releaseId: string;
        trackTitle: string;
        isrc?: string;
        composition: CompositionInfo;
        distributionCopies?: number;
    }): Promise<MechanicalLicense> {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not authenticated');

        const copies = params.distributionCopies ?? 1000;
        const fee = parseFloat((copies * STATUTORY_RATE_USD).toFixed(2));

        const licenseId = `ml_${uid}_${Date.now()}`;
        const license: Omit<MechanicalLicense, 'createdAt' | 'updatedAt'> = {
            id: licenseId,
            userId: uid,
            releaseId: params.releaseId,
            trackTitle: params.trackTitle,
            isrc: params.isrc,
            composition: params.composition,
            status: params.composition.controlled ? 'pending_search' : 'not_required',
            distributionCopies: copies,
            ratePerCopy: STATUTORY_RATE_USD,
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
     */
    async getLicenses(releaseId?: string): Promise<MechanicalLicense[]> {
        const uid = auth.currentUser?.uid;
        if (!uid) return [];

        try {
            const col = collection(db, COLLECTION, uid, 'licenses');
            const q = releaseId ? query(col, where('releaseId', '==', releaseId)) : query(col);
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as MechanicalLicense));
        } catch (err: unknown) {
            logger.error('MechanicalRoyaltyService.getLicenses failed', err);
            return [];
        }
    },

    /**
     * Check if all cover tracks in a release have active or not-required licenses.
     */
    async isReleaseClearedForDistribution(releaseId: string): Promise<{
        cleared: boolean;
        pendingTracks: string[];
    }> {
        const licenses = await this.getLicenses(releaseId);
        const pending = licenses.filter(
            l => l.status !== 'license_active' && l.status !== 'not_required'
        );
        return {
            cleared: pending.length === 0,
            pendingTracks: pending.map(l => l.trackTitle),
        };
    },

    /** Compute the total mechanical royalty fee for a set of licenses. */
    computeTotalFee(licenses: MechanicalLicense[]): number {
        return parseFloat(
            licenses
                .filter(l => l.status !== 'not_required')
                .reduce((sum, l) => sum + l.totalFee, 0)
                .toFixed(2)
        );
    },
};
