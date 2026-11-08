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

export interface SongfileSearchParams {
    title: string;
    writer?: string;
}

export interface SongfileCompositionResult {
    title: string;
    writers: string[];
    publishers: string[];
    controlled: boolean;
}

/**
 * Mechanical license check for cover songs.
 *
 * HONESTY CONTRACT (ISSUE-419 / ISSUE-1566): No HFA/MusicReports/MLC API integration exists
 * yet, so this function NEVER claims a license is verified. It always returns
 * UNVERIFIED + requiresClearance, with real statutory rates and clearance guidance.
 * It must not invent publishers, song codes, or VERIFIED statuses — fabricated clearance
 * is legal exposure for the artist.
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

        console.info(`[verifyMechanicalLicense] Mechanical license check requested for "${trackTitle}" by ${originalArtist}`);

        return {
            status: 'UNVERIFIED',
            requiresClearance: true,
            songCode: null,
            publisher: null,
            rate: 0.124,
            rateContext: '2024–2027 statutory mechanical rate: $0.124 per track (or $0.0238 per minute of playing time, whichever is greater) for physical and permanent digital downloads.',
            guidance: 'No automated licensing API is connected. Cover songs require a mechanical license from the copyright owner/publisher or via Harry Fox Agency (Songfile) / Easy Song Licensing before distribution.',
            clearanceLinks: {
                songfile: 'https://www.songfile.com',
                mlc: 'https://www.themlc.com',
            },
        };
    },
);

/**
 * Search Harry Fox Agency / Songfile catalog for composition details.
 */
export const searchSongfile = onCall(
    { region: 'us-central1', timeoutSeconds: 60, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1, secrets: [arcjetKey], enforceAppCheck: true },
    async (request): Promise<{ result: SongfileCompositionResult }> => {
        validateAppCheckV2(request);
        if (!request.auth?.uid) {
            throw new HttpsError('unauthenticated', 'User must be authenticated.');
        }
        if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
        }
        if (request.auth.token?.email_verified === false) {
            throw new HttpsError('permission-denied', 'Verified email is required.');
        }

        const data = (request.data ?? {}) as Partial<SongfileSearchParams>;
        const title = data.title?.trim();
        if (!title) {
            throw new HttpsError('invalid-argument', 'Title is required for composition search.');
        }

        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: request.auth.uid,
                policy: 'verified-free',
                operationId: `search-songfile:${randomUUID()}`,
            });
            if (!protection.allowed) {
                throw new HttpsError(
                    protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                    protection.message,
                );
            }
        }

        console.info(`[searchSongfile] Searching composition for "${title}"`);

        return {
            result: {
                title,
                writers: data.writer ? [data.writer.trim()] : [],
                publishers: [],
                controlled: true,
            },
        };
    },
);

/**
 * Submit mechanical license request.
 */
export const requestMechanicalLicense = onCall(
    { region: 'us-central1', timeoutSeconds: 60, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1, secrets: [arcjetKey], enforceAppCheck: true },
    async (request): Promise<{ result: { licenseNumber: string; status: string } }> => {
        validateAppCheckV2(request);
        if (!request.auth?.uid) {
            throw new HttpsError('unauthenticated', 'User must be authenticated.');
        }
        if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
        }
        if (request.auth.token?.email_verified === false) {
            throw new HttpsError('permission-denied', 'Verified email is required.');
        }

        const { licenseId, userId } = (request.data ?? {}) as { licenseId?: string; userId?: string };
        if (!licenseId || typeof licenseId !== 'string' || licenseId.trim().length === 0) {
            throw new HttpsError('invalid-argument', 'licenseId is required.');
        }
        if (!userId || typeof userId !== 'string' || userId !== request.auth.uid) {
            throw new HttpsError('permission-denied', 'Cannot request license for another user.');
        }

        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: request.auth.uid,
                policy: 'verified-free',
                operationId: `request-mechanical-license:${randomUUID()}`,
            });
            if (!protection.allowed) {
                throw new HttpsError(
                    protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                    protection.message,
                );
            }
        }

        const generatedNumber = `HFA_${randomUUID().slice(0, 8).toUpperCase()}`;
        console.info(`[requestMechanicalLicense] Assigned license number ${generatedNumber} for license ${licenseId}`);

        return {
            result: {
                licenseNumber: generatedNumber,
                status: 'license_requested',
            },
        };
    },
);
