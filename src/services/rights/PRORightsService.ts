/**
 * PRORightsService
 *
 * Handles PRO (Performing Rights Organization) work registration and
 * mechanical licensing verification for each release submission.
 *
 * Items 229-232:
 *   229 — ASCAP Work Registration API
 *   230 — BMI Songwriting Registration
 *   231 — SoundExchange Digital Performance Enrollment
 *   232 — Harry Fox / Music Reports Cover Song Verification
 */

import { db } from '@/services/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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
// Item 229: ASCAP Work Registration
// ────────────────────────────────────────────────────────────────────

/**
 * Register a musical work with ASCAP via their Work Registration API.
 * Requires an ASCAP publisher/writer account API token (stored in Firestore).
 *
 * ASCAP API: https://api.ascap.com/works/register
 * Production: Requires ASCAP data licensing agreement + partner credentials.
 */
export async function registerWithASCAP(
    uid: string,
    metadata: ExtendedGoldenMetadata
): Promise<PRORegistrationResult> {
    const submittedAt = Date.now();

    try {
        // Retrieve stored ASCAP API credentials
        const credRef = doc(db, 'users', uid, 'proCredentials', 'ascap');
        const credSnap = await getDoc(credRef);
        const creds = credSnap.data() as { apiKey?: string; accountId?: string } | undefined;

        if (!creds?.apiKey) {
            logger.warn('[PRORightsService] ASCAP API key not configured, queuing for manual registration');
            // Queue for manual registration tracking in Firestore
            await setDoc(
                doc(db, 'users', uid, 'proRegistrations', `ascap-${metadata.id || Date.now()}`),
                {
                    organization: 'ASCAP',
                    status: 'pending_credentials',
                    workTitle: metadata.trackTitle,
                    composerName: metadata.composerName || metadata.artistName,
                    iswc: metadata.iswc || null,
                    isrc: metadata.isrc || null,
                    submittedAt: serverTimestamp(),
                },
                { merge: true }
            );
            return {
                success: false,
                organization: 'ASCAP',
                error: 'ASCAP API credentials not configured. Work queued for manual registration. Go to Settings > Rights to add your ASCAP account.',
                requiresManualReview: true,
                submittedAt,
            };
        }

        const workPayload = {
            title: metadata.trackTitle,
            writers: [
                {
                    name: metadata.composerName || metadata.artistName,
                    ipi: metadata.composerIPI || null,
                    role: 'Composer/Lyricist',
                    ownership: 100,
                }
            ],
            publishers: [
                {
                    name: metadata.labelName || metadata.publisherName || 'Self-Published',
                    role: 'Original Publisher',
                    ownership: metadata.publisherShare || 50,
                }
            ],
            iswc: metadata.iswc || null,
            isrc: metadata.isrc || null,
            duration: metadata.durationSeconds || null,
        };

        const response = await fetch('https://api.ascap.com/v1/works/register', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${creds.apiKey}`,
                'Content-Type': 'application/json',
                'X-ASCAP-Account': creds.accountId || '',
            },
            body: JSON.stringify(workPayload),
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({})) as { message?: string };
            return {
                success: false,
                organization: 'ASCAP',
                error: errData.message || `ASCAP API error ${response.status}`,
                requiresManualReview: true,
                submittedAt,
            };
        }

        const data = await response.json() as { workId?: string; iswc?: string };

        // Persist registration record
        await setDoc(
            doc(db, 'users', uid, 'proRegistrations', `ascap-${data.workId || Date.now()}`),
            {
                organization: 'ASCAP',
                status: 'registered',
                workId: data.workId,
                iswc: data.iswc,
                workTitle: metadata.trackTitle,
                submittedAt: serverTimestamp(),
            },
            { merge: true }
        );

        logger.info(`[PRORightsService] ASCAP registration successful: ${data.workId}`);
        return { success: true, organization: 'ASCAP', workId: data.workId, iswc: data.iswc, submittedAt };

    } catch (err: unknown) {
        logger.error('[PRORightsService] ASCAP registration error:', err);
        return {
            success: false,
            organization: 'ASCAP',
            error: err instanceof Error ? err.message : 'ASCAP registration failed',
            requiresManualReview: true,
            submittedAt,
        };
    }
}

// ────────────────────────────────────────────────────────────────────
// Item 230: BMI Songwriting Registration
// ────────────────────────────────────────────────────────────────────

/**
 * Register a musical work with BMI via the BMI Works Express API.
 * Requires a BMI publisher account and API credentials.
 *
 * BMI API: https://worksexpress.bmi.com (requires BMI publisher membership)
 */
export async function registerWithBMI(
    uid: string,
    metadata: ExtendedGoldenMetadata
): Promise<PRORegistrationResult> {
    const submittedAt = Date.now();

    try {
        const credRef = doc(db, 'users', uid, 'proCredentials', 'bmi');
        const credSnap = await getDoc(credRef);
        const creds = credSnap.data() as { username?: string; password?: string; publisherNumber?: string } | undefined;

        if (!creds?.username || !creds?.password) {
            await setDoc(
                doc(db, 'users', uid, 'proRegistrations', `bmi-${metadata.id || Date.now()}`),
                {
                    organization: 'BMI',
                    status: 'pending_credentials',
                    workTitle: metadata.trackTitle,
                    submittedAt: serverTimestamp(),
                },
                { merge: true }
            );
            return {
                success: false,
                organization: 'BMI',
                error: 'BMI credentials not configured. Work queued for manual registration. Go to Settings > Rights to add your BMI account.',
                requiresManualReview: true,
                submittedAt,
            };
        }

        // BMI Works Express uses form-based auth + XML submission
        // Step 1: Get session token
        const authRes = await fetch('https://worksexpress.bmi.com/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: creds.username, password: creds.password }),
            signal: AbortSignal.timeout(10000),
        });

        if (!authRes.ok) {
            return { success: false, organization: 'BMI', error: `BMI auth failed: ${authRes.status}`, requiresManualReview: true, submittedAt };
        }

        const { token } = await authRes.json() as { token: string };

        // Step 2: Register work
        const workRes = await fetch('https://worksexpress.bmi.com/api/works', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                workTitle: metadata.trackTitle,
                iswc: metadata.iswc || null,
                isrc: metadata.isrc || null,
                writers: [{
                    name: metadata.composerName || metadata.artistName,
                    ipi: metadata.composerIPI || null,
                    role: 'CA', // Composer/Author
                    share: 100,
                }],
                publishers: [{
                    number: creds.publisherNumber,
                    share: metadata.publisherShare || 50,
                }],
            }),
            signal: AbortSignal.timeout(15000),
        });

        if (!workRes.ok) {
            const err = await workRes.json().catch(() => ({})) as { message?: string };
            return { success: false, organization: 'BMI', error: err.message || `BMI API error ${workRes.status}`, requiresManualReview: true, submittedAt };
        }

        const data = await workRes.json() as { workId?: string; iswc?: string };

        await setDoc(
            doc(db, 'users', uid, 'proRegistrations', `bmi-${data.workId || Date.now()}`),
            { organization: 'BMI', status: 'registered', workId: data.workId, iswc: data.iswc, workTitle: metadata.trackTitle, submittedAt: serverTimestamp() },
            { merge: true }
        );

        logger.info(`[PRORightsService] BMI registration successful: ${data.workId}`);
        return { success: true, organization: 'BMI', workId: data.workId, iswc: data.iswc, submittedAt };

    } catch (err: unknown) {
        logger.error('[PRORightsService] BMI registration error:', err);
        return { success: false, organization: 'BMI', error: err instanceof Error ? err.message : 'BMI registration failed', requiresManualReview: true, submittedAt };
    }
}

// ────────────────────────────────────────────────────────────────────
// Item 231: SoundExchange Digital Performance Enrollment
// ────────────────────────────────────────────────────────────────────

/**
 * Enroll sound recordings with SoundExchange for digital performance royalties.
 * SoundExchange collects royalties for satellite (SiriusXM) and internet radio plays.
 *
 * Enrollment is typically a one-time setup per release, not per track.
 * Uses SoundExchange's registration form API (requires partner agreement).
 */
export async function enrollWithSoundExchange(
    uid: string,
    metadata: ExtendedGoldenMetadata
): Promise<SoundExchangeEnrollmentResult> {
    const submittedAt = Date.now();

    try {
        const credRef = doc(db, 'users', uid, 'proCredentials', 'soundexchange');
        const credSnap = await getDoc(credRef);
        const creds = credSnap.data() as { apiKey?: string; memberId?: string } | undefined;

        const enrollmentData = {
            isrc: metadata.isrc,
            trackTitle: metadata.trackTitle,
            artistName: metadata.artistName,
            labelName: metadata.labelName || 'Self-Released',
            releaseYear: metadata.releaseDate ? new Date(metadata.releaseDate).getFullYear() : new Date().getFullYear(),
            upc: metadata.upc || null,
        };

        if (!creds?.apiKey) {
            // Queue enrollment in Firestore for manual processing
            const docRef = doc(db, 'users', uid, 'soundExchangeEnrollments', `se-${metadata.isrc || Date.now()}`);
            await setDoc(docRef, {
                status: 'pending_credentials',
                ...enrollmentData,
                submittedAt: serverTimestamp(),
            }, { merge: true });

            return {
                success: false,
                error: 'SoundExchange credentials not configured. Enrollment queued. Go to Settings > Rights to configure.',
                submittedAt,
            };
        }

        const response = await fetch('https://api.soundexchange.com/v1/enrollments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${creds.apiKey}`,
                'X-SE-Member': creds.memberId || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(enrollmentData),
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            return { success: false, error: `SoundExchange enrollment failed: ${response.status}`, submittedAt };
        }

        const data = await response.json() as { enrollmentId?: string };

        await setDoc(
            doc(db, 'users', uid, 'soundExchangeEnrollments', `se-${data.enrollmentId || Date.now()}`),
            { status: 'enrolled', enrollmentId: data.enrollmentId, ...enrollmentData, submittedAt: serverTimestamp() },
            { merge: true }
        );

        logger.info(`[PRORightsService] SoundExchange enrollment: ${data.enrollmentId}`);
        return { success: true, enrollmentId: data.enrollmentId, submittedAt };

    } catch (err: unknown) {
        logger.error('[PRORightsService] SoundExchange enrollment error:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Enrollment failed', submittedAt };
    }
}

// ────────────────────────────────────────────────────────────────────
// Item 232: Harry Fox / Music Reports Cover Song Verification
// ────────────────────────────────────────────────────────────────────

/**
 * Verify mechanical license issuance for cover songs via Music Reports Inc.
 * (Formerly Harry Fox Agency — HFA was acquired by Music Reports in 2015.)
 *
 * Required before delivering a cover song to any distributor.
 * API: Music Reports Songfile API (requires MRI partner agreement)
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
        const credRef = doc(db, 'users', uid, 'proCredentials', 'musicreports');
        const credSnap = await getDoc(credRef);
        const creds = credSnap.data() as { apiKey?: string } | undefined;

        if (!creds?.apiKey) {
            // Check if license was manually confirmed
            const licenseRef = doc(db, 'users', uid, 'coverLicenses', metadata.isrc || `cover-${Date.now()}`);
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

            return {
                isVerified: false,
                requiresLicense: true,
                error: 'Music Reports API not configured and no manual license confirmation found. You must obtain a mechanical license before delivering this cover song.',
                submittedAt,
            };
        }

        // Search for existing license via Music Reports Songfile
        const searchRes = await fetch(
            `https://api.musicreports.com/v1/licenses/search?isrc=${encodeURIComponent(metadata.isrc || '')}&title=${encodeURIComponent(metadata.originalSongTitle || metadata.trackTitle)}`,
            {
                headers: { 'Authorization': `Bearer ${creds.apiKey}` },
                signal: AbortSignal.timeout(10000),
            }
        );

        if (!searchRes.ok) {
            return {
                isVerified: false,
                requiresLicense: true,
                error: `Music Reports API error: ${searchRes.status}`,
                submittedAt,
            };
        }

        const data = await searchRes.json() as { licenses?: Array<{ licenseNumber: string; type: string; royaltyRate: number }> };
        const license = data.licenses?.[0];

        if (license) {
            logger.info(`[PRORightsService] Cover song license verified: ${license.licenseNumber}`);
            return {
                isVerified: true,
                licenseNumber: license.licenseNumber,
                licenseType: license.type as CoverSongVerificationResult['licenseType'],
                royaltyRate: license.royaltyRate,
                requiresLicense: true,
                submittedAt,
            };
        }

        // No license found — needs to be obtained
        return {
            isVerified: false,
            requiresLicense: true,
            error: 'No mechanical license found for this cover song. Obtain a license via Songfile (musicreports.com) before distribution.',
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
