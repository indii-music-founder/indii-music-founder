/**
 * AssetRightsService.ts
 *
 * Asset usage-rights metadata (Workstream H2 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §13). Persisted per asset so the
 * distribution pipeline (I1) can gate delivery on a rights record, and so the
 * UI can require disclosure where licensing demands it.
 *
 * Honest limit (A-8): v1 ships rights as a sidecar metadata record + manifest,
 * not in-browser EXIF/IPTC pixel embedding (not reliable — a future optional
 * lib addition).
 */

import { auth, db } from '@/services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { logger } from '@/utils/logger';

export type UsageRights = 'ai-generated' | 'ai-assisted' | 'owned-licensed' | 'licensed-third-party';

export interface AssetRights {
    releaseId?: string;
    usageRights: UsageRights;
    licenseNotes?: string;
    disclosureRequired: boolean;
}

const VALID_RIGHTS: readonly UsageRights[] = ['ai-generated', 'ai-assisted', 'owned-licensed', 'licensed-third-party'];

/**
 * Validate rights. Returns an array of human-readable errors (empty = valid).
 * - invalid usageRights rejected
 * - `licensed-third-party` requires licenseNotes
 */
export function validateRights(rights: Partial<AssetRights>): string[] {
    const errors: string[] = [];
    if (rights.usageRights === undefined || rights.usageRights === null) {
        errors.push('usageRights is required');
    } else if (!VALID_RIGHTS.includes(rights.usageRights)) {
        errors.push(`invalid usageRights "${String(rights.usageRights)}". Valid: ${VALID_RIGHTS.join(', ')}`);
    }
    if (rights.usageRights === 'licensed-third-party' && !rights.licenseNotes?.trim()) {
        errors.push('licensed-third-party requires licenseNotes');
    }
    if (rights.usageRights !== 'licensed-third-party' && rights.disclosureRequired === undefined) {
        errors.push('disclosureRequired must be set');
    }
    return errors;
}

class AssetRightsServiceImpl {
    private getUid(): string | null {
        return auth.currentUser?.uid ?? null;
    }

    private rightsDoc(assetId: string) {
        const uid = this.getUid();
        if (!uid) throw new Error('User not authenticated');
        if (!assetId) throw new Error('assetId is required');
        return doc(db, 'users', uid, 'assetRights', assetId);
    }

    async setRights(assetId: string, rights: AssetRights): Promise<void> {
        const errors = validateRights(rights);
        if (errors.length > 0) {
            const e = new Error(`Invalid asset rights: ${errors.join('; ')}`);
            (e as Error & { validationErrors?: string[] }).validationErrors = errors;
            throw e;
        }
        await setDoc(this.rightsDoc(assetId), {
            ...rights,
            updatedAt: Date.now()
        });
        logger.info('[AssetRights] Set rights for asset', assetId, `(${rights.usageRights})`);
    }

    async getRights(assetId: string): Promise<AssetRights | null> {
        try {
            const snap = await getDoc(this.rightsDoc(assetId));
            return snap.exists() ? (snap.data() as AssetRights) : null;
        } catch (err) {
            logger.error('[AssetRights] getRights failed', err);
            return null;
        }
    }
}

export const AssetRightsService = new AssetRightsServiceImpl();
