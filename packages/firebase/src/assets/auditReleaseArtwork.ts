import { onCall, HttpsError } from 'firebase-functions/v2/https';

import { auditReleaseArtwork, type AssetResolutionAudit } from './AssetResolutionAuditService.js';

function releaseIdFrom(value: unknown): string {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new HttpsError('invalid-argument', 'releaseId is required.');
    }
    const releaseId = (value as Record<string, unknown>).releaseId;
    if (typeof releaseId !== 'string' || !releaseId.trim() || releaseId.includes('/') || releaseId.length > 200) {
        throw new HttpsError('invalid-argument', 'releaseId is invalid.');
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
export const auditReleaseArtworkForDelivery = onCall(
    { region: 'us-central1', enforceAppCheck: false, timeoutSeconds: 60, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request): Promise<AssetResolutionAudit> => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'An authenticated owner is required to audit release artwork.');
        }
        try {
            return await auditReleaseArtworkForOwner(request.auth.uid, request.data);
        } catch (error) {
            // Trap 2 of 7 (see ISSUE-1243). `releaseIdFrom` raises the
            // invalid-argument errors this is meant to pass through; both are
            // v2 now, so they survive instead of being flattened to
            // failed-precondition.
            if (error instanceof HttpsError) throw error;
            throw new HttpsError(
                'failed-precondition',
                error instanceof Error ? error.message : 'Release artwork audit failed.',
            );
        }
    },
);
