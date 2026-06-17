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

        console.log(`[verifyMechanicalLicense] Mechanical license check requested for "${trackTitle}" by ${originalArtist} — no licensing API integrated, returning UNVERIFIED.`);

        // US statutory mechanical rate for physical/permanent downloads (tracks <= 5 min),
        // CRB Phonorecords IV. Informational only — streaming mechanicals are calculated
        // as a percentage-of-revenue formula administered by The MLC, not a flat rate.
        const statutoryPhysicalRate = 0.124;

        const response: MechanicalLicenseResponse = {
            status: 'UNVERIFIED',
            requiresClearance: true,
            songCode: null,
            publisher: null,
            rate: statutoryPhysicalRate,
            rateContext: 'US statutory rate for physical/permanent downloads <= 5 min (CRB Phonorecords IV). Streaming mechanicals use The MLC revenue-share formula.',
            guidance: 'Automated publisher verification is not available. Obtain a mechanical license before distributing this cover: use HFA SongFile for downloads/physical, and confirm streaming mechanical coverage via The MLC.',
            clearanceLinks: {
                songfile: 'https://www.songfile.com/',
                mlc: 'https://www.themlc.com/',
            },
        };

        // Persist the honest audit trail — records that a check was REQUESTED
        // and clearance is outstanding, not that anything was verified.
        const db = getFirestore();
        const requestId = `${context.auth.uid}-${Date.now()}`;
        const verificationRef = db.collection('mechanical_license_verifications').doc(requestId);
        await verificationRef.set({
            userId: context.auth.uid,
            trackTitle,
            originalArtist,
            status: 'UNVERIFIED',
            requiresClearance: true,
            publisher: null,
            songCode: null,
            rate: statutoryPhysicalRate,
            requestedAt: new Date().toISOString(),
        }, { merge: true });

        return response;
    });
