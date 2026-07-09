import * as functions from 'firebase-functions/v1';
import { getFirestore } from 'firebase-admin/firestore';

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
export const verifyMechanicalLicense = functions
    .region('us-central1')
    .runWith({ memory: '256MB', timeoutSeconds: 60 })
    .https.onCall(async (data: MechanicalLicenseRequest, context: functions.https.CallableContext): Promise<MechanicalLicenseResponse> => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'User must be authenticated to run verification.'
            );
        }

        const { trackTitle, originalArtist } = data;

        if (!trackTitle || typeof trackTitle !== 'string' || trackTitle.trim().length === 0 ||
            !originalArtist || typeof originalArtist !== 'string' || originalArtist.trim().length === 0) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                "Missing or invalid 'trackTitle' or 'originalArtist'."
            );
        }

        console.log(`[verifyMechanicalLicense] Mechanical license check requested for "${trackTitle}" by ${originalArtist} — no licensing API integrated.`);

        throw new functions.https.HttpsError(
            'unimplemented',
            'Mechanical licensing API not integrated. Please use HFA SongFile or The MLC to obtain mechanical licenses.'
        );
    });
