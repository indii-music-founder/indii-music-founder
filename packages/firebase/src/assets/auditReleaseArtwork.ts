import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomUUID } from 'node:crypto';
import { arcjetKey } from '../config/secrets.js';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet.js';
import { validateAppCheckV2 } from '../middleware/appCheck.js';
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
    { region: 'us-central1', enforceAppCheck: false, secrets: [arcjetKey], timeoutSeconds: 60, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request): Promise<AssetResolutionAudit> => {
        const uid = request.auth?.uid;
        if (!uid || request.auth?.token?.email_verified === false || request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('unauthenticated', 'A verified signed-in owner is required to audit release artwork.');
        }
        validateAppCheckV2(request);
        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: uid,
                policy: 'verified-free',
                operationId: `audit-release-artwork:${randomUUID()}`,
            });
            if (!protection.allowed) {
                throw new HttpsError(
                    protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                    protection.message,
                );
            }
        }
        try {
            return await auditReleaseArtworkForOwner(uid, request.data);
        } catch (error) {
            // Passes `releaseIdFrom`'s invalid-argument errors through instead
            // of flattening them to failed-precondition. Reference renamed from
            // functions.https.HttpsError under ISSUE-1243; behavior unchanged,
            // since v1 and v2 share one HttpsError class.
            if (error instanceof HttpsError) throw error;
            throw new HttpsError(
                'failed-precondition',
                error instanceof Error ? error.message : 'Release artwork audit failed.',
            );
        }
    },
);
