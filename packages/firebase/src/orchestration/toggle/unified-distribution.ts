import { HttpsError, onCall } from 'firebase-functions/v2/https';

/**
 * Retired compatibility endpoint for the old Firebase-only distribution flow.
 *
 * It previously emitted incomplete XML and wrote it to provider-named Storage
 * paths without XSD/profile validation, canonical master packaging, a
 * recipient DPID, or partner transport. Direct delivery is now intentionally
 * owned by the canonical desktop/Python package path, which fails closed until
 * the DDEX licence, recipient profile, XSDs, and partner route are configured.
 */
export const triggerUnifiedDistribution = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');

    const releaseId = typeof request.data?.releaseId === 'string' ? request.data.releaseId.trim() : '';
    if (!releaseId) throw new HttpsError('invalid-argument', 'Missing releaseId.');

    throw new HttpsError(
        'failed-precondition',
        'Canonical DDEX delivery is required. This retired Firebase staging path cannot create or deliver a partner package.'
    );
});
