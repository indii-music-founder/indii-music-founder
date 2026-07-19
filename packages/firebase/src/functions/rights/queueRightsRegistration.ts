import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { validateAppCheckV2 } from '../../middleware/appCheck';

// Ensure Firebase admin is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

export type RightsProvider = 'ascap' | 'bmi' | 'soundexchange';

export interface RightsRegistrationMetadata {
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

export interface QueuedRightsRegistrationResponse {
    queued: true;
    provider: RightsProvider;
    /** Always an honest non-registered state — see honesty contract below. */
    status: 'manual_required';
    organization: string;
    manualUrl: string;
    guidance: string;
    recordPath: string;
    submittedAt: number;
}

/**
 * HONESTY CONTRACT (ISSUE-655, same covenant as verifyMechanicalLicense/ISSUE-419):
 * No ASCAP, BMI, or SoundExchange registration API integration exists — those
 * organizations require partner agreements that indii does not hold yet. This
 * function therefore NEVER returns a 'registered'/'enrolled' status and never
 * touches provider credentials. It records the registration request server-side
 * with status 'manual_required' and returns real member-portal guidance. When a
 * real partner API is integrated, a registered status may only come from that
 * API's actual response, loaded and called HERE (server-side) — provider
 * credentials must never reach the renderer.
 */
const PROVIDER_QUEUE_CONFIG: Record<RightsProvider, {
    organization: string;
    collection: (uid: string) => string;
    manualUrl: string;
    guidance: string;
}> = {
    ascap: {
        organization: 'ASCAP',
        collection: (uid) => `users/${uid}/proRegistrations`,
        manualUrl: 'https://www.ascap.com/myascap',
        guidance: 'Automated ASCAP work registration is not available. Log in to ASCAP Works and register this title manually — your work details are saved to this request.',
    },
    bmi: {
        organization: 'BMI',
        collection: (uid) => `users/${uid}/proRegistrations`,
        manualUrl: 'https://worksexpress.bmi.com',
        guidance: 'Automated BMI work registration is not available. Log in to BMI Works Express and register this title manually — your work details are saved to this request.',
    },
    soundexchange: {
        organization: 'SoundExchange',
        collection: (uid) => `users/${uid}/soundExchangeEnrollments`,
        manualUrl: 'https://www.soundexchange.com/member-login',
        guidance: 'Automated SoundExchange enrollment is not available. Log in to your SoundExchange member account and enroll this recording manually — your recording details are saved to this request.',
    },
};

function optionalString(value: unknown, maxLength = 500): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, maxLength);
}

function optionalNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function parseRightsProvider(value: unknown): RightsProvider {
    if (value === 'ascap' || value === 'bmi' || value === 'soundexchange') return value;
    throw new HttpsError('invalid-argument', "provider must be one of 'ascap', 'bmi', 'soundexchange'.");
}

export function sanitizeRightsMetadata(raw: unknown): RightsRegistrationMetadata {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new HttpsError('invalid-argument', 'metadata must be an object.');
    }
    const data = raw as Record<string, unknown>;
    const trackTitle = optionalString(data.trackTitle, 240);
    if (!trackTitle) {
        throw new HttpsError('invalid-argument', 'metadata.trackTitle is required.');
    }
    return {
        trackTitle,
        iswc: optionalString(data.iswc, 40),
        isrc: optionalString(data.isrc, 40),
        upc: optionalString(data.upc, 40),
        composerName: optionalString(data.composerName, 240),
        composerIPI: optionalString(data.composerIPI, 40),
        artistName: optionalString(data.artistName, 240),
        labelName: optionalString(data.labelName, 240),
        publisherName: optionalString(data.publisherName, 240),
        publisherShare: optionalNumber(data.publisherShare),
        releaseDate: optionalString(data.releaseDate, 40),
    };
}

/** Doc ids must be deterministic so a re-queued registration updates in place instead of duplicating (see ISSUE-657). */
function buildQueueDocId(provider: RightsProvider, metadata: RightsRegistrationMetadata): string {
    const key = metadata.isrc || metadata.iswc || metadata.trackTitle;
    return `${provider}-${key.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 120)}`;
}

export async function processQueueRightsRegistration(
    uid: string,
    provider: RightsProvider,
    metadata: RightsRegistrationMetadata
): Promise<QueuedRightsRegistrationResponse> {
    const config = PROVIDER_QUEUE_CONFIG[provider];
    const docId = buildQueueDocId(provider, metadata);
    const recordPath = `${config.collection(uid)}/${docId}`;

    await admin.firestore().doc(recordPath).set(
        {
            organization: config.organization,
            status: 'manual_required',
            workTitle: metadata.trackTitle,
            iswc: metadata.iswc ?? null,
            isrc: metadata.isrc ?? null,
            upc: metadata.upc ?? null,
            composerName: metadata.composerName ?? null,
            artistName: metadata.artistName ?? null,
            labelName: metadata.labelName ?? null,
            publisherName: metadata.publisherName ?? null,
            publisherShare: metadata.publisherShare ?? null,
            releaseDate: metadata.releaseDate ?? null,
            manualUrl: config.manualUrl,
            guidance: config.guidance,
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    logger.info(`[queueRightsRegistration] Queued ${config.organization} registration for user ${uid} (${recordPath}) — manual_required, no provider API integrated.`);

    return {
        queued: true,
        provider,
        status: 'manual_required',
        organization: config.organization,
        manualUrl: config.manualUrl,
        guidance: config.guidance,
        recordPath,
        submittedAt: Date.now(),
    };
}

export const queueRightsRegistration = onCall(
    { enforceAppCheck: false, timeoutSeconds: 30 },
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Sign in to queue a rights registration.');
        }
        const provider = parseRightsProvider(request.data?.provider);
        const metadata = sanitizeRightsMetadata(request.data?.metadata);
        return processQueueRightsRegistration(request.auth.uid, provider, metadata);
    }
);
