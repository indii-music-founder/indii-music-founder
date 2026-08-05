/**
 * ArtistOperatingProfileService — ISSUE-1172 (re-ticketed from ISSUE-1115).
 *
 * Persists the Artist Operating Profile (AOP): preferences, boundaries, and
 * permissions that inform autonomous execution decisions. Previously this
 * information existed only scattered across static config (ToolRiskRegistry.ts)
 * and per-directive compute allocation (DigitalHandshake.ts) — no per-user
 * record of e.g. "has this artist opted into autonomous computer control."
 *
 * Storage: single doc at users/{uid}/aop/profile.
 *
 * First real consumer: BaseAgent.ts's tool-dispatch loop calls
 * hasAutonomousComputerControl() before queuing a `computer_*` approval —
 * see the ISSUE-1172 gate right before the ISSUE-1116 approval-queue gate.
 */
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { getRealAuthenticatedUserId } from '@/utils/authGuards';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import {
    ArtistOperatingProfileSchema,
    DEFAULT_ARTIST_OPERATING_PROFILE,
    type ArtistOperatingProfile,
} from '@indii/shared';

function getUserId(): string | null {
    return getRealAuthenticatedUserId(auth.currentUser);
}

function getProfileDocRef(uid: string) {
    return doc(db, 'users', uid, 'aop', 'profile');
}

class ArtistOperatingProfileService {
    /**
     * Fail-closed: returns the default (opted-out) profile when unauthenticated,
     * in E2E mock mode, or when no doc has ever been saved. Never throws for a
     * missing doc — a brand-new artist has no AOP yet, which is a valid state,
     * not an error.
     */
    async getProfile(): Promise<ArtistOperatingProfile> {
        if (isFirebaseE2EMockEnabled()) return DEFAULT_ARTIST_OPERATING_PROFILE;
        const uid = getUserId();
        if (!uid) return DEFAULT_ARTIST_OPERATING_PROFILE;

        try {
            const snap = await getDoc(getProfileDocRef(uid));
            if (!snap.exists()) return DEFAULT_ARTIST_OPERATING_PROFILE;
            const parsed = ArtistOperatingProfileSchema.safeParse(snap.data());
            if (!parsed.success) {
                logger.warn('[ArtistOperatingProfileService] Stored profile failed schema validation, falling back to defaults', parsed.error);
                return DEFAULT_ARTIST_OPERATING_PROFILE;
            }
            return parsed.data;
        } catch (err) {
            logger.error('[ArtistOperatingProfileService] getProfile failed', err);
            return DEFAULT_ARTIST_OPERATING_PROFILE;
        }
    }

    /** Merges `updates` into the existing profile (or defaults) and persists the full document. */
    async updateProfile(updates: Partial<Omit<ArtistOperatingProfile, 'schemaVersion'>>): Promise<ArtistOperatingProfile> {
        const uid = getUserId();
        if (!uid) throw new Error('Not authenticated — cannot update Artist Operating Profile');

        const current = await this.getProfile();
        const next: ArtistOperatingProfile = ArtistOperatingProfileSchema.parse({
            ...current,
            ...updates,
            permissions: { ...current.permissions, ...updates.permissions },
            schemaVersion: 'artist-operating-profile.v1',
        });

        await setDoc(getProfileDocRef(uid), { ...next, updatedAt: serverTimestamp() });
        logger.info('[ArtistOperatingProfileService] Profile updated');
        return next;
    }

    /** Live subscription to the current user's AOP — feeds the Settings > Automation section. */
    onProfileChange(callback: (profile: ArtistOperatingProfile) => void): Unsubscribe {
        if (isFirebaseE2EMockEnabled()) {
            callback(DEFAULT_ARTIST_OPERATING_PROFILE);
            return () => {};
        }
        const uid = getUserId();
        if (!uid) {
            callback(DEFAULT_ARTIST_OPERATING_PROFILE);
            return () => {};
        }

        return onSnapshot(
            getProfileDocRef(uid),
            (snap) => {
                if (!snap.exists()) {
                    callback(DEFAULT_ARTIST_OPERATING_PROFILE);
                    return;
                }
                const parsed = ArtistOperatingProfileSchema.safeParse(snap.data());
                callback(parsed.success ? parsed.data : DEFAULT_ARTIST_OPERATING_PROFILE);
            },
            (error) => {
                logger.error('[ArtistOperatingProfileService] onProfileChange listener error:', error);
            },
        );
    }
}

export const artistOperatingProfileService = new ArtistOperatingProfileService();
