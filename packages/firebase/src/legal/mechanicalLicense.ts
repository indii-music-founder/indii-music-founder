import { onCall, HttpsError } from 'firebase-functions/v2/https';

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
    { region: 'us-central1', timeoutSeconds: 60 },
    async (request): Promise<MechanicalLicenseResponse> => {
        if (!request.auth) {
            throw new HttpsError(
                'unauthenticated',
                'User must be authenticated to run verification.'
            );
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
