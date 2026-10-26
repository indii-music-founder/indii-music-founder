import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { arcjetKey } from '../../config/secrets';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { enforceRateLimit, RATE_LIMITS } from '../../lib/rateLimit';
import { protectAuthenticatedApiRequest } from '../security/arcjet';

/**
 * Mints a single-use, time-limited link so a payment collaborator (who has
 * no indii account) can upload their own W-9/W-8BEN without the artist
 * relaying the file by hand. The link is embedded in the notification email
 * sent by the client (ResendEmailService) — this function only mints it.
 */

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const APP_BASE_URL = 'https://app.indii.music';

interface RequestTaxFormUploadInput {
    collaboratorId: string;
}

export interface RequestTaxFormUploadResult {
    uploadUrl: string;
    expiresAt: number;
}

export async function processRequestTaxFormUpload(
    uid: string,
    collaboratorId: string
): Promise<RequestTaxFormUploadResult> {
    if (typeof collaboratorId !== 'string' || collaboratorId.length === 0) {
        throw new HttpsError('invalid-argument', 'collaboratorId is required.');
    }

    const db = admin.firestore();
    const collaboratorRef = db.doc(`users/${uid}/tax_collaborators/${collaboratorId}`);
    const collaboratorSnap = await collaboratorRef.get();
    if (!collaboratorSnap.exists) {
        throw new HttpsError('not-found', 'Collaborator not found.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await db.collection('taxFormRequests').doc(token).set({
        artistUid: uid,
        collaboratorId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
        consumedAt: null,
    });

    return {
        uploadUrl: `${APP_BASE_URL}/tax-form-upload?token=${token}`,
        expiresAt: expiresAt.getTime(),
    };
}

export const requestTaxFormUpload = onCall<RequestTaxFormUploadInput>(
    {
        enforceAppCheck: false,
        timeoutSeconds: 30,
        memory: '512MiB',
        secrets: [arcjetKey],
    },
    async (request): Promise<RequestTaxFormUploadResult> => {
        validateAppCheckV2(request);
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError('unauthenticated', 'Sign in to request a tax form.');
        }
        if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
        }
        if (request.auth.token?.email_verified === false) {
            throw new HttpsError('permission-denied', 'Verified email is required.');
        }
        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: request.auth.uid,
                policy: 'verified-free',
                operationId: `request-tax-form-upload:${crypto.randomUUID()}`,
            });
            if (!protection.allowed) {
                throw new HttpsError(
                    protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                    protection.message,
                );
            }
        }

        await enforceRateLimit(request.auth.uid, 'requestTaxFormUpload', RATE_LIMITS.sensitive);

        return processRequestTaxFormUpload(request.auth.uid, request.data?.collaboratorId);
    }
);
