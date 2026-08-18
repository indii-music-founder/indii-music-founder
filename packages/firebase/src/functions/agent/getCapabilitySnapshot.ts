import { randomUUID } from 'node:crypto';

import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

import { arcjetKey } from '../../config/secrets';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import {
    CAPABILITY_SNAPSHOT_SCHEMA_VERSION,
    type CapabilityEvidence,
    type CapabilitySnapshot,
    type CapabilityStatus,
} from '../../shared/capabilitySnapshot';
import {
    policyClassForServerEntitlement,
    protectAuthenticatedApiRequest,
} from '../security/arcjet';
import {
    requireVerifiedServerEntitlement,
    type AccountEntitlement,
} from '../auth/entitlements';

const SNAPSHOT_TTL_MS = 2 * 60_000;
const RECENT_MEDIA_SUCCESS_MS = 7 * 24 * 60 * 60_000;

interface MediaJobEvidence {
    type?: unknown;
    status?: unknown;
    completedAt?: unknown;
}

interface SocialConnectionEvidence {
    accessToken?: unknown;
    expiresAt?: unknown;
}

export interface CapabilityEvidenceReader {
    verifyWorkspaceAccess(uid: string): Promise<void>;
    verifyMemoryAccess(uid: string): Promise<void>;
    listRecentMediaJobs(uid: string): Promise<MediaJobEvidence[]>;
    listSocialConnections(uid: string): Promise<SocialConnectionEvidence[]>;
}

function firestoreEvidenceReader(firestore: Firestore): CapabilityEvidenceReader {
    return {
        async verifyWorkspaceAccess(uid): Promise<void> {
            await firestore.collection('projects').where('userId', '==', uid).limit(1).get();
        },
        async verifyMemoryAccess(uid): Promise<void> {
            await firestore.collection('users').doc(uid).collection('memories').limit(1).get();
        },
        async listRecentMediaJobs(uid): Promise<MediaJobEvidence[]> {
            // ISSUE-1359: order by createdAt descending so the limit window
            // always contains the most recent jobs. Without orderBy, Firestore
            // returns documents in document-ID order, so once a user has more
            // than 50 jobs, recent completed generations can fall outside the
            // window and the snapshot reports image/video generation as
            // unverified — the agent then truthfully reports the pipeline as
            // "offline" even though generation works.
            const snapshot = await firestore.collection('creative_jobs')
                .where('userId', '==', uid)
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();
            return snapshot.docs.map(document => document.data());
        },
        async listSocialConnections(uid): Promise<SocialConnectionEvidence[]> {
            const snapshot = await firestore.collection('users').doc(uid)
                .collection('socialTokens')
                .get();
            return snapshot.docs.map(document => document.data());
        },
    };
}

function timestampMillis(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    if (value && typeof value === 'object' && 'toMillis' in value) {
        const toMillis = (value as { toMillis?: unknown }).toMillis;
        if (typeof toMillis === 'function') {
            const parsed = toMillis.call(value);
            return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
        }
    }
    return undefined;
}

function evidence(
    status: CapabilityStatus,
    observedAt: number,
    expiresAt: number,
    approvalRequired?: boolean,
): CapabilityEvidence {
    return {
        status,
        observedAt,
        expiresAt,
        ...(approvalRequired === undefined ? {} : { approvalRequired }),
    };
}

async function statusFromRead(read: () => Promise<void>): Promise<CapabilityStatus> {
    try {
        await read();
        return 'available';
    } catch {
        return 'unverified';
    }
}

async function mediaStatuses(
    reader: CapabilityEvidenceReader,
    uid: string,
    now: number,
): Promise<{
    image: { status: CapabilityStatus; evidenceExpiresAt?: number };
    video: { status: CapabilityStatus; evidenceExpiresAt?: number };
}> {
    try {
        const jobs = await reader.listRecentMediaJobs(uid);
        const successExpiresAt = (job: MediaJobEvidence): number | undefined => {
            const completedAt = timestampMillis(job.completedAt);
            if (
                job.status === 'completed'
                && completedAt !== undefined
                && completedAt <= now
                && completedAt + RECENT_MEDIA_SUCCESS_MS > now
            ) {
                return completedAt + RECENT_MEDIA_SUCCESS_MS;
            }
            return undefined;
        };
        const expirationsFor = (types: string[]): number[] => jobs
            .filter(job => types.includes(String(job.type)))
            .map(successExpiresAt)
            .filter((value): value is number => value !== undefined);
        const imageExpirations = expirationsFor(['image']);
        const videoExpirations = expirationsFor(['video', 'omni-video']);
        return {
            image: imageExpirations.length > 0
                ? { status: 'available', evidenceExpiresAt: Math.max(...imageExpirations) }
                : { status: 'unverified' },
            video: videoExpirations.length > 0
                ? { status: 'available', evidenceExpiresAt: Math.max(...videoExpirations) }
                : { status: 'unverified' },
        };
    } catch {
        return {
            image: { status: 'unverified' },
            video: { status: 'unverified' },
        };
    }
}

async function socialStatus(
    reader: CapabilityEvidenceReader,
    uid: string,
    now: number,
): Promise<{ status: CapabilityStatus; connectionExpiresAt?: number }> {
    try {
        const connections = await reader.listSocialConnections(uid);
        const validExpirations = connections
            .filter(connection =>
                typeof connection.accessToken === 'string'
                && connection.accessToken.length > 0
                && typeof connection.expiresAt === 'number'
                && Number.isFinite(connection.expiresAt)
                && connection.expiresAt > now
            )
            .map(connection => connection.expiresAt as number);
        if (validExpirations.length === 0) return { status: 'blocked' };
        return {
            status: 'available',
            connectionExpiresAt: Math.max(...validExpirations),
        };
    } catch {
        return { status: 'unverified' };
    }
}

export async function buildServerCapabilitySnapshot(
    uid: string,
    dependencies: {
        reader?: CapabilityEvidenceReader;
        now?: number;
        specialistRoutingDisabled?: boolean;
        imageGenerationDisabled?: boolean;
        videoGenerationDisabled?: boolean;
    } = {},
): Promise<CapabilitySnapshot> {
    const now = dependencies.now ?? Date.now();
    const expiresAt = now + SNAPSHOT_TTL_MS;
    const reader = dependencies.reader ?? firestoreEvidenceReader(getFirestore());

    const [workspace, memory, media, social] = await Promise.all([
        statusFromRead(() => reader.verifyWorkspaceAccess(uid)),
        statusFromRead(() => reader.verifyMemoryAccess(uid)),
        mediaStatuses(reader, uid, now),
        socialStatus(reader, uid, now),
    ]);

    const specialistRouting = dependencies.specialistRoutingDisabled === true
        ? 'blocked'
        : 'unverified';
    const image = dependencies.imageGenerationDisabled === true ? 'blocked' : media.image.status;
    const video = dependencies.videoGenerationDisabled === true ? 'blocked' : media.video.status;
    const imageExpiresAt = image === 'available' && media.image.evidenceExpiresAt !== undefined
        ? Math.min(expiresAt, media.image.evidenceExpiresAt)
        : expiresAt;
    const videoExpiresAt = video === 'available' && media.video.evidenceExpiresAt !== undefined
        ? Math.min(expiresAt, media.video.evidenceExpiresAt)
        : expiresAt;
    const socialExpiresAt = social.status === 'available' && social.connectionExpiresAt !== undefined
        ? Math.min(expiresAt, social.connectionExpiresAt)
        : expiresAt;

    return {
        schemaVersion: CAPABILITY_SNAPSHOT_SCHEMA_VERSION,
        observedAt: now,
        expiresAt,
        capabilities: {
            specialist_routing: evidence(specialistRouting, now, expiresAt),
            image_generation: evidence(image, now, imageExpiresAt),
            video_generation: evidence(video, now, videoExpiresAt),
            durable_workspace: evidence(workspace, now, expiresAt),
            durable_memory: evidence(memory, now, expiresAt),
            calendar_connection: evidence('blocked', now, expiresAt),
            calendar_actions: evidence('blocked', now, expiresAt, true),
            social_connection: evidence(social.status, now, socialExpiresAt),
            social_publishing: evidence(social.status, now, socialExpiresAt, true),
        },
    };
}

export async function admitCapabilitySnapshotRequest(
    request: CallableRequest<unknown>,
    dependencies: {
        validateAppCheck?: typeof validateAppCheckV2;
        resolveEntitlement?: typeof requireVerifiedServerEntitlement;
        protect?: typeof protectAuthenticatedApiRequest;
        policyForEntitlement?: typeof policyClassForServerEntitlement;
    } = {},
): Promise<{ uid: string; entitlement: AccountEntitlement }> {
    const validateAppCheck = dependencies.validateAppCheck ?? validateAppCheckV2;
    const resolveEntitlement = dependencies.resolveEntitlement ?? requireVerifiedServerEntitlement;
    const protect = dependencies.protect ?? protectAuthenticatedApiRequest;
    const policyForEntitlement = dependencies.policyForEntitlement ?? policyClassForServerEntitlement;

    validateAppCheck(request);
    const uid = typeof request.auth?.uid === 'string' ? request.auth.uid : '';
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
    assertEmptyCapabilityRequestData(request.data);

    const entitlement = await resolveEntitlement(uid);
    if (!request.rawRequest) {
        throw new HttpsError('unavailable', 'Request protection is temporarily unavailable.');
    }
    const protection = await protect(request.rawRequest, {
        userId: uid,
        policy: policyForEntitlement({
            tier: entitlement.tier,
            isAdmin: request.auth?.token.admin === true,
        }),
        operationId: `capability-snapshot:${randomUUID()}`,
    });
    if (!protection.allowed) {
        const code = protection.status === 429
            ? 'resource-exhausted'
            : protection.status === 403
                ? 'permission-denied'
                : 'unavailable';
        throw new HttpsError(code, protection.message, {
            code: protection.code,
            ...(protection.retryAfterSeconds
                ? { retryAfterSeconds: protection.retryAfterSeconds }
                : {}),
        });
    }
    return { uid, entitlement };
}

export function assertEmptyCapabilityRequestData(data: unknown): void {
    if (data === undefined || data === null) return;
    if (
        typeof data === 'object'
        && !Array.isArray(data)
        && Object.keys(data as Record<string, unknown>).length === 0
    ) {
        return;
    }
    throw new HttpsError(
        'invalid-argument',
        'Capability status does not accept account, session, or plan claims.',
    );
}

export const capabilitySnapshotCallableOptions = {
    secrets: [arcjetKey],
    enforceAppCheck: true,
    region: 'us-central1',
    timeoutSeconds: 15,
    memory: '512MiB' as const,
};

export async function resolveCapabilitySnapshotRequest(
    request: CallableRequest<unknown>,
    dependencies: {
        validateAppCheck?: typeof validateAppCheckV2;
        resolveEntitlement?: typeof requireVerifiedServerEntitlement;
        protect?: typeof protectAuthenticatedApiRequest;
        policyForEntitlement?: typeof policyClassForServerEntitlement;
        reader?: CapabilityEvidenceReader;
        now?: number;
        specialistRoutingDisabled?: boolean;
        imageGenerationDisabled?: boolean;
        videoGenerationDisabled?: boolean;
    } = {},
): Promise<CapabilitySnapshot> {
    const { uid } = await admitCapabilitySnapshotRequest(request, dependencies);
    return buildServerCapabilitySnapshot(uid, dependencies);
}

export const getCapabilitySnapshot = onCall(
    capabilitySnapshotCallableOptions,
    request => resolveCapabilitySnapshotRequest(request, {
        specialistRoutingDisabled: process.env.DISABLE_FINE_TUNED === 'true',
        imageGenerationDisabled: process.env.DISABLE_IMAGE_GENERATION === 'true',
        videoGenerationDisabled: process.env.DISABLE_VIDEO_GENERATION === 'true',
    }),
);
