/**
 * PRORightsService
 *
 * Handles PRO (Performing Rights Organization) work registration and
 * mechanical licensing verification for each release submission.
 *
 * Items 229-232:
 *   229 — ASCAP Work Registration
 *   230 — BMI Songwriting Registration
 *   231 — SoundExchange Digital Performance Enrollment
 *   232 — Harry Fox / Music Reports Cover Song Verification
 *
 * HONESTY + SECURITY CONTRACT (ISSUE-655, covenant of ISSUE-419):
 * Provider credentials must NEVER be loaded or used in the renderer, and no
 * ASCAP/BMI/SoundExchange/Music Reports registration API integration exists
 * (all require partner agreements indii does not hold). This service therefore
 * only sends release METADATA to secured backend callables:
 *   - `queueRightsRegistration` records an honest 'manual_required' request
 *     server-side and returns real member-portal guidance — never 'registered'.
 *   - `verifyMechanicalLicense` (ISSUE-419) never claims a license is verified
 *     without a real licensing API response.
 * The only Firestore read here is the user's OWN manually-confirmed cover
 * license doc — user data, not a provider secret.
 */

import { db, functions } from '@/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { logger } from '@/utils/logger';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

export type PROOrganization = 'ASCAP' | 'BMI' | 'SESAC' | 'SOCAN' | 'PRS' | 'GEMA';

export interface PRORegistrationResult {
    success: boolean;
    organization: PROOrganization;
    workId?: string;
    iswc?: string;
    error?: string;
    requiresManualReview?: boolean;
    submittedAt: number;
}

export interface SoundExchangeEnrollmentResult {
    success: boolean;
    enrollmentId?: string;
    error?: string;
    submittedAt: number;
}

export interface CoverSongVerificationResult {
    isVerified: boolean;
    licenseNumber?: string;
    licenseType?: 'compulsory' | 'direct' | 'hfa' | 'musicreports';
    royaltyRate?: number;    // cents per unit
    error?: string;
    requiresLicense: boolean;
    submittedAt: number;
}

// ────────────────────────────────────────────────────────────────────
// Backend boundary — the renderer sends release metadata ONLY
// ────────────────────────────────────────────────────────────────────

type QueueableProvider = 'ascap' | 'bmi' | 'soundexchange';

interface RightsRegistrationMetadata {
    trackTitle: string;
    iswc?: string;
    isrc?: string;
    upc?: string;
    composerName?: string;
    composerIPI?: string;
    artistName?: string;
    labelName?: string;
    publisherName?: string;
    publisherShare?: number;
    releaseDate?: string;
}

interface QueuedRightsRegistrationResponse {
    queued: true;
    provider: QueueableProvider;
    status: 'manual_required';
    organization: string;
    manualUrl: string;
    guidance: string;
    recordPath: string;
    submittedAt: number;
}

/**
 * Whitelist-picks the metadata fields the backend accepts. Nothing else —
 * especially no credential-shaped values — may cross this boundary.
 */
function toRegistrationMetadata(metadata: ExtendedGoldenMetadata): RightsRegistrationMetadata {
    return {
        trackTitle: metadata.trackTitle,
        iswc: metadata.iswc || undefined,
        isrc: metadata.isrc || undefined,
        upc: metadata.upc || undefined,
        composerName: metadata.composerName || metadata.artistName || undefined,
        composerIPI: metadata.composerIPI || undefined,
        artistName: metadata.artistName || undefined,
        labelName: metadata.labelName || undefined,
        publisherName: metadata.publisherName || undefined,
        publisherShare: typeof metadata.publisherShare === 'number' ? metadata.publisherShare : undefined,
        releaseDate: metadata.releaseDate || undefined,
    };
}

async function queueRegistrationWithBackend(
    provider: QueueableProvider,
    metadata: ExtendedGoldenMetadata
): Promise<QueuedRightsRegistrationResponse> {
    const queueFn = httpsCallable<
        { provider: QueueableProvider; metadata: RightsRegistrationMetadata },
        QueuedRightsRegistrationResponse
    >(functions, 'queueRightsRegistration');
    const { data } = await queueFn({ provider, metadata: toRegistrationMetadata(metadata) });
    return data;
}

// ────────────────────────────────────────────────────────────────────
// Item 229/230: ASCAP + BMI Work Registration (queued, manual completion)
// ────────────────────────────────────────────────────────────────────

async function queuePRORegistration(
    organization: 'ASCAP' | 'BMI',
    provider: 'ascap' | 'bmi',
    metadata: ExtendedGoldenMetadata,
    manualFallbackUrl: string
): Promise<PRORegistrationResult> {
    const submittedAt = Date.now();
    try {
        const queued = await queueRegistrationWithBackend(provider, metadata);
        logger.info(`[PRORightsService] ${organization} registration queued for manual completion (${queued.recordPath}).`);
        // Honest state: the work is queued, not registered. `success` means a
        // completed provider registration and no such integration exists.
        return {
            success: false,
            organization,
            error: queued.guidance,
            requiresManualReview: true,
            submittedAt,
        };
    } catch (err: unknown) {
        logger.error(`[PRORightsService] ${organization} registration queueing failed:`, err);
        return {
            success: false,
            organization,
            error: `Could not save the ${organization} registration request (${err instanceof Error ? err.message : 'service unavailable'}). Register the work manually at ${manualFallbackUrl}.`,
            requiresManualReview: true,
            submittedAt,
        };
    }
}

/**
 * Queue an ASCAP work registration. Identity comes from the authenticated
 * session (the backend uses the caller's auth token, never a client-sent uid).
 */
export async function registerWithASCAP(
    _uid: string,
    metadata: ExtendedGoldenMetadata
): Promise<PRORegistrationResult> {
    return queuePRORegistration('ASCAP', 'ascap', metadata, 'https://www.ascap.com/myascap');
}

/**
 * Queue a BMI work registration. Identity comes from the authenticated
 * session (the backend uses the caller's auth token, never a client-sent uid).
 */
export async function registerWithBMI(
    _uid: string,
    metadata: ExtendedGoldenMetadata
): Promise<PRORegistrationResult> {
    return queuePRORegistration('BMI', 'bmi', metadata, 'https://worksexpress.bmi.com');
}

// ────────────────────────────────────────────────────────────────────
// Item 231: SoundExchange Digital Performance Enrollment (queued)
// ────────────────────────────────────────────────────────────────────

export async function enrollWithSoundExchange(
    _uid: string,
    metadata: ExtendedGoldenMetadata
): Promise<SoundExchangeEnrollmentResult> {
    const submittedAt = Date.now();
    try {
        const queued = await queueRegistrationWithBackend('soundexchange', metadata);
        logger.info(`[PRORightsService] SoundExchange enrollment queued for manual completion (${queued.recordPath}).`);
        return {
            success: false,
            error: queued.guidance,
            submittedAt,
        };
    } catch (err: unknown) {
        logger.error('[PRORightsService] SoundExchange enrollment queueing failed:', err);
        return {
            success: false,
            error: `Could not save the SoundExchange enrollment request (${err instanceof Error ? err.message : 'service unavailable'}). Enroll manually at https://www.soundexchange.com/member-login.`,
            submittedAt,
        };
    }
}

// ────────────────────────────────────────────────────────────────────
// Item 232: Harry Fox / Music Reports Cover Song Verification
// ────────────────────────────────────────────────────────────────────

interface MechanicalLicenseCheckResponse {
    status: string;
    requiresClearance: boolean;
    songCode: string | null;
    publisher: string | null;
    rate: number;
    guidance?: string;
}

/**
 * Verify mechanical license coverage for a cover song.
 *
 * The only path to `isVerified: true` for a cover is the user's own manually
 * confirmed license doc (`users/{uid}/coverLicenses/{isrc}`). The backend
 * `verifyMechanicalLicense` callable honestly returns UNVERIFIED until a real
 * licensing API is integrated (ISSUE-419) — this function never upgrades that.
 */
export async function verifyCoverSongLicense(
    uid: string,
    metadata: ExtendedGoldenMetadata
): Promise<CoverSongVerificationResult> {
    const submittedAt = Date.now();

    // If not a cover song, no license required
    if (!metadata.isCoverSong) {
        return { isVerified: true, requiresLicense: false, submittedAt };
    }

    try {
        // 1) A manually confirmed license recorded by the user is real evidence.
        if (metadata.isrc) {
            const licenseRef = doc(db, 'users', uid, 'coverLicenses', metadata.isrc);
            const licenseSnap = await getDoc(licenseRef);
            if (licenseSnap.exists() && licenseSnap.data()?.status === 'confirmed') {
                return {
                    isVerified: true,
                    licenseNumber: licenseSnap.data()?.licenseNumber,
                    licenseType: 'direct',
                    requiresLicense: true,
                    submittedAt,
                };
            }
        }

        // 2) Ask the backend. It returns UNVERIFIED + clearance guidance until a
        //    real HFA/MusicReports/MLC integration exists.
        const verifyFn = httpsCallable<
            { trackTitle: string; originalArtist: string },
            MechanicalLicenseCheckResponse
        >(functions, 'verifyMechanicalLicense');
        // The metadata schema has no original-artist field; the covering artist
        // is recorded for the audit trail.
        const { data } = await verifyFn({
            trackTitle: metadata.originalSongTitle || metadata.trackTitle,
            originalArtist: metadata.artistName || 'Unknown',
        });

        return {
            isVerified: false,
            requiresLicense: true,
            royaltyRate: data.rate,
            error: data.guidance || 'No mechanical license verified for this cover song. Obtain a license (e.g. via Songfile or The MLC) and confirm it before distribution.',
            submittedAt,
        };
    } catch (err: unknown) {
        logger.error('[PRORightsService] Cover song verification error:', err);
        return {
            isVerified: false,
            requiresLicense: true,
            error: err instanceof Error ? err.message : 'Cover song verification failed',
            submittedAt,
        };
    }
}

// ────────────────────────────────────────────────────────────────────
// Unified Rights Check — Called on Release Submission
// ────────────────────────────────────────────────────────────────────

export interface RightsCheckResult {
    ascap?: PRORegistrationResult;
    bmi?: PRORegistrationResult;
    soundExchange?: SoundExchangeEnrollmentResult;
    coverSong?: CoverSongVerificationResult;
    overallBlocking: boolean;
    warnings: string[];
}

/**
 * Run all rights checks for a release submission.
 * Returns aggregate results with a `overallBlocking` flag that indicates
 * whether delivery should be blocked.
 */
export async function runRightsCheck(
    uid: string,
    metadata: ExtendedGoldenMetadata,
    userPRO: 'ASCAP' | 'BMI' | 'SESAC' | 'none'
): Promise<RightsCheckResult> {
    const warnings: string[] = [];
    const results: Partial<RightsCheckResult> = {};

    const checks = await Promise.allSettled([
        // Register with selected PRO
        userPRO === 'ASCAP' ? registerWithASCAP(uid, metadata) : Promise.resolve(null),
        userPRO === 'BMI' ? registerWithBMI(uid, metadata) : Promise.resolve(null),
        enrollWithSoundExchange(uid, metadata),
        metadata.isCoverSong ? verifyCoverSongLicense(uid, metadata) : Promise.resolve({ isVerified: true, requiresLicense: false, submittedAt: Date.now() }),
    ]);

    if (checks[0].status === 'fulfilled' && checks[0].value) results.ascap = checks[0].value as PRORegistrationResult;
    if (checks[1].status === 'fulfilled' && checks[1].value) results.bmi = checks[1].value as PRORegistrationResult;
    if (checks[2].status === 'fulfilled') results.soundExchange = checks[2].value as SoundExchangeEnrollmentResult;
    if (checks[3].status === 'fulfilled') results.coverSong = checks[3].value as CoverSongVerificationResult;

    // Cover song without license = blocking
    const coverBlocking = results.coverSong?.requiresLicense && !results.coverSong?.isVerified;
    if (coverBlocking) warnings.push('Cover song delivery is blocked: mechanical license required');

    // PRO registration failures are non-blocking (can register manually later)
    if (results.ascap?.requiresManualReview) warnings.push('ASCAP registration requires manual review');
    if (results.bmi?.requiresManualReview) warnings.push('BMI registration requires manual review');

    return {
        ...results,
        overallBlocking: !!coverBlocking,
        warnings,
    };
}

// Item 138 (PRO Live Setlist Submission): the renderer-side `submitSetlistToPRO`
// was removed (ISSUE-656) — it faked gateway success and stamped setlists
// `Submitted` without any external call. Setlists are queued honestly via the
// `log_live_setlist_for_pro` agent tool (RoadTools.ts); real ASCAP OnStage /
// BMI Live submission must go through a secured backend per ISSUE-655.
