import * as functions from 'firebase-functions/v1';

import { auditReleaseArtwork, type AssetResolutionAudit } from './AssetResolutionAuditService.js';

function releaseIdFrom(value: unknown): string {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new functions.https.HttpsError('invalid-argument', 'releaseId is required.');
    }
    const releaseId = (value as Record<string, unknown>).releaseId;
    if (typeof releaseId !== 'string' || !releaseId.trim() || releaseId.includes('/') || releaseId.length > 200) {
        throw new functions.https.HttpsError('invalid-argument', 'releaseId is invalid.');
    }
    return releaseId.trim();
}

/** Kept separate from the Firebase wrapper so owner binding is directly testable. */
export async function auditReleaseArtworkForOwner(
    ownerUid: string,
    data: unknown,
    audit = auditReleaseArtwork,
): Promise<AssetResolutionAudit> {
    return audit(ownerUid, releaseIdFrom(data));
}

/**
 * Server-only release gate. The caller supplies only a release id; ownership,
 * object inspection, immutable receipt persistence, and release attachment all
 * happen on the backend.
 */
export const auditReleaseArtworkForDelivery = functions
    .region('us-central1')
    .runWith({ enforceAppCheck: false, memory: '512MB', timeoutSeconds: 60 })
    .https.onCall(async (data: unknown, context): Promise<AssetResolutionAudit> => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'An authenticated owner is required to audit release artwork.');
        }
        try {
            return await auditReleaseArtworkForOwner(context.auth.uid, data);
        } catch (error) {
            if (error instanceof functions.https.HttpsError) throw error;
            throw new functions.https.HttpsError(
                'failed-precondition',
                error instanceof Error ? error.message : 'Release artwork audit failed.',
            );
        }
    });
