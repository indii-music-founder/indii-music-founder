import { randomUUID } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { arcjetKey } from '../config/secrets';
import { validateAppCheckV2 } from '../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';

export interface MechanicalLicenseRequest {
    trackTitle: string;
    originalArtist: string;
}

export interface MechanicalLicenseResponse {
    status: 'UNVERIFIED';
    requiresClearance: true;
    songCode: null;
    publisher: null;
    rate: number;
    rateContext: string;
    guidance: string;
    clearanceLinks: { songfile: string; mlc: string };
}

/**
 * Mechanical license check for cover songs.
 *
 * HONESTY CONTRACT (ISSUE-419): No HFA/MusicReports/MLC API integration exists
 * yet, so this function NEVER claims a license is verified. It always returns
 * UNVERIFIED + requiresClearance, with real clearance guidance. It must not
 * invent publishers, song codes, or VERIFIED statuses — fabricated clearance
 * is legal exposure for the artist. When a real licensing API is integrated,
 * a VERIFIED status may only be returned from that API's actual response.
 */
export const verifyMechanicalLicense = onCall(
    { region: 'us-central1', timeoutSeconds: 60, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1, secrets: [arcjetKey], enforceAppCheck: true },
    async (request): Promise<MechanicalLicenseResponse> => {
        validateAppCheckV2(request);
        if (!request.auth?.uid) {
            throw new HttpsError(
                'unauthenticated',
                'User must be authenticated to run verification.'
            );
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
                operationId: `verify-mechanical-license:${randomUUID()}`,
            });
            if (!protection.allowed) {
                throw new HttpsError(
                    protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                    protection.message,
                );
            }
        }

        const { trackTitle, originalArtist } = (request.data ?? {}) as MechanicalLicenseRequest;

        if (!trackTitle || typeof trackTitle !== 'string' || trackTitle.trim().length === 0 ||
            !originalArtist || typeof originalArtist !== 'string' || originalArtist.trim().length === 0) {
            throw new HttpsError(
                'invalid-argument',
                "Missing or invalid 'trackTitle' or 'originalArtist'."
            );
        }

        console.log(`[verifyMechanicalLicense] Mechanical license check requested for "${trackTitle}" by ${originalArtist} — no licensing API integrated.`);

        throw new HttpsError(
            'unimplemented',
            'Mechanical licensing API not integrated. Please use HFA SongFile or The MLC to obtain mechanical licenses.'
        );
    },
);
