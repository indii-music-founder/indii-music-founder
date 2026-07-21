import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { validateAppCheckV2 } from '../../middleware/appCheck';

const MAX_SESSION_BYTES = 20 * 1024 * 1024 * 1024;
const RETENTION_DAYS = 30;

const CreateVideoSessionRequestSchema = z.object({
    organizationId: z.string().trim().min(1).max(256),
    projectId: z.string().trim().min(1).max(256),
    idempotencyKey: z.string().trim().min(8).max(256),
    expectedMimeType: z.enum(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']),
    expectedByteSize: z.number().int().positive().max(MAX_SESSION_BYTES),
}).strict();

export interface SessionProcessingCostEstimate {
    currency: 'USD';
    amountMinor: number;
    estimateVersion: string;
}

export interface PersistedVideoSession {
    schemaVersion: 'video-session.v1';
    sessionId: string;
    ownerUid: string;
    organizationId: string;
    projectId: string;
    idempotencyKey: string;
    uploadSessionId: string;
    expectedMimeType: string;
    expectedByteSize: number;
    stagingBucket: string;
    stagingPath: string;
    status: 'uploading';
    costEstimate: SessionProcessingCostEstimate;
    retentionDeleteAfter: string;
    createdAt: string;
    updatedAt: string;
}

export interface VideoSessionClaimStore {
    claim(proposed: PersistedVideoSession): Promise<{
        session: unknown;
        created: boolean;
    }>;
}

interface CreateVideoSessionDependencies {
    store: VideoSessionClaimStore;
    bucketName: string;
    now: () => Date;
    estimateCost: (input: {
        expectedMimeType: string;
        expectedByteSize: number;
    }) => SessionProcessingCostEstimate;
    authorizeProject: (ownerUid: string, organizationId: string, projectId: string) => Promise<void>;
}

export interface CreateVideoSessionResult {
    created: boolean;
    session: PersistedVideoSession;
    upload: {
        storageUri: string;
        expectedMimeType: string;
        expectedByteSize: number;
        requiredMetadata: {
            ownerUid: string;
            organizationId: string;
            projectId: string;
            sessionId: string;
            uploadSessionId: string;
        };
    };
}

function memberListContains(members: unknown, ownerUid: string): boolean {
    if (Array.isArray(members)) return members.includes(ownerUid);
    return !!members
        && typeof members === 'object'
        && !Array.isArray(members)
        && Object.prototype.hasOwnProperty.call(members, ownerUid);
}

export function projectAllowsVideoSession(
    ownerUid: string,
    requestedOrganizationId: string,
    project: Record<string, unknown> | undefined,
    organization?: Record<string, unknown>,
): boolean {
    if (!project || project.orgId !== requestedOrganizationId) return false;
    if (project.userId === ownerUid || project.ownerUid === ownerUid || project.ownerId === ownerUid) return true;
    if (requestedOrganizationId === 'personal' || requestedOrganizationId === 'org-default') return false;
    return organization?.ownerId === ownerUid || memberListContains(organization?.members, ownerUid);
}

export function estimateSessionProxyCost(
    expectedByteSize: number,
    env: NodeJS.ProcessEnv,
): SessionProcessingCostEstimate {
    const ratePerGiB = Number(env.SESSION_PROXY_ESTIMATE_USD_PER_GIB);
    const estimateVersion = env.SESSION_PROXY_ESTIMATE_VERSION?.trim();
    if (!Number.isFinite(ratePerGiB) || ratePerGiB < 0 || !estimateVersion) {
        throw new HttpsError('failed-precondition', 'Session proxy pricing is not configured.');
    }
    const gibibytes = expectedByteSize / (1024 * 1024 * 1024);
    return {
        currency: 'USD',
        amountMinor: Math.ceil(gibibytes * ratePerGiB * 100),
        estimateVersion,
    };
}

export function createFirestoreVideoSessionClaimStore(
    db: FirebaseFirestore.Firestore = getFirestore(),
): VideoSessionClaimStore {
    return {
        async claim(proposed) {
            const sessionRef = db.collection('videoSessions').doc(proposed.sessionId);
            return db.runTransaction(async (transaction) => {
                const existing = await transaction.get(sessionRef);
                if (existing.exists) {
                    return { session: existing.data(), created: false };
                }
                transaction.create(sessionRef, proposed);
                return { session: proposed, created: true };
            });
        },
    };
}

export async function assertVideoSessionProjectAccess(
    ownerUid: string,
    organizationId: string,
    projectId: string,
    db: FirebaseFirestore.Firestore = getFirestore(),
): Promise<void> {
    const projectSnapshot = await db.collection('projects').doc(projectId).get();
    const project = projectSnapshot.exists
        ? projectSnapshot.data() as Record<string, unknown>
        : undefined;

    let organization: Record<string, unknown> | undefined;
    if (
        project
        && project.orgId === organizationId
        && project.userId !== ownerUid
        && project.ownerUid !== ownerUid
        && project.ownerId !== ownerUid
        && organizationId !== 'personal'
        && organizationId !== 'org-default'
    ) {
        const organizationSnapshot = await db.collection('organizations').doc(organizationId).get();
        organization = organizationSnapshot.exists
            ? organizationSnapshot.data() as Record<string, unknown>
            : undefined;
    }

    if (!projectAllowsVideoSession(ownerUid, organizationId, project, organization)) {
        throw new HttpsError('permission-denied', 'Project is not available to this owner and organization.');
    }
}

function extensionForMimeType(mimeType: string): string {
    switch (mimeType) {
        case 'video/quicktime': return 'mov';
        case 'video/webm': return 'webm';
        case 'video/x-m4v': return 'm4v';
        default: return 'mp4';
    }
}

function stableSessionId(ownerUid: string, organizationId: string, projectId: string, idempotencyKey: string): string {
    return createHash('sha256')
        .update(`${ownerUid}\0${organizationId}\0${projectId}\0${idempotencyKey}`)
        .digest('hex')
        .slice(0, 40);
}

function assertClaimMatches(
    rawSession: unknown,
    proposed: PersistedVideoSession,
): asserts rawSession is PersistedVideoSession {
    if (!rawSession || typeof rawSession !== 'object' || Array.isArray(rawSession)) {
        throw new HttpsError('failed-precondition', 'The existing upload session is malformed.');
    }
    const session = rawSession as Record<string, unknown>;
    const immutableFields: Array<keyof PersistedVideoSession> = [
        'schemaVersion',
        'sessionId',
        'ownerUid',
        'organizationId',
        'projectId',
        'idempotencyKey',
        'uploadSessionId',
        'expectedMimeType',
        'expectedByteSize',
        'stagingBucket',
        'stagingPath',
    ];
    if (immutableFields.some((field) => session[field] !== proposed[field])) {
        throw new HttpsError('failed-precondition', 'The existing upload session does not match this request.');
    }
}

export async function createOwnedVideoSession(
    ownerUid: string,
    rawRequest: unknown,
    dependencies: CreateVideoSessionDependencies,
): Promise<CreateVideoSessionResult> {
    const parsedOwnerUid = z.string().trim().min(1).max(256).safeParse(ownerUid);
    const parsedRequest = CreateVideoSessionRequestSchema.safeParse(rawRequest);
    if (!parsedOwnerUid.success || !parsedRequest.success) {
        throw new HttpsError('invalid-argument', 'A valid owner and long-video upload request are required.');
    }

    const input = parsedRequest.data;
    await dependencies.authorizeProject(
        parsedOwnerUid.data,
        input.organizationId,
        input.projectId,
    );
    const bucketName = dependencies.bucketName.trim();
    if (!/^[a-z0-9][a-z0-9._-]+[a-z0-9]$/.test(bucketName)) {
        throw new HttpsError('failed-precondition', 'The private media bucket is not configured.');
    }

    const now = dependencies.now();
    if (Number.isNaN(now.getTime())) {
        throw new HttpsError('internal', 'The session clock returned an invalid timestamp.');
    }

    const sessionId = stableSessionId(
        parsedOwnerUid.data,
        input.organizationId,
        input.projectId,
        input.idempotencyKey,
    );
    const extension = extensionForMimeType(input.expectedMimeType);
    const stagingPath = `session-media/${parsedOwnerUid.data}/${sessionId}/staging/original.${extension}`;
    const createdAt = now.toISOString();
    const retentionDeleteAfter = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const costEstimate = dependencies.estimateCost({
        expectedMimeType: input.expectedMimeType,
        expectedByteSize: input.expectedByteSize,
    });
    if (
        costEstimate.currency !== 'USD'
        || !Number.isInteger(costEstimate.amountMinor)
        || costEstimate.amountMinor < 0
        || !costEstimate.estimateVersion.trim()
    ) {
        throw new HttpsError('failed-precondition', 'The media-processing cost estimate is invalid.');
    }

    const proposed: PersistedVideoSession = {
        schemaVersion: 'video-session.v1',
        sessionId,
        ownerUid: parsedOwnerUid.data,
        organizationId: input.organizationId,
        projectId: input.projectId,
        idempotencyKey: input.idempotencyKey,
        uploadSessionId: `upload-${sessionId}`,
        expectedMimeType: input.expectedMimeType,
        expectedByteSize: input.expectedByteSize,
        stagingBucket: bucketName,
        stagingPath,
        status: 'uploading',
        costEstimate,
        retentionDeleteAfter,
        createdAt,
        updatedAt: createdAt,
    };

    const claim = await dependencies.store.claim(proposed);
    assertClaimMatches(claim.session, proposed);
    const session = claim.session;

    return {
        created: claim.created,
        session,
        upload: {
            storageUri: `gs://${session.stagingBucket}/${session.stagingPath}`,
            expectedMimeType: session.expectedMimeType,
            expectedByteSize: session.expectedByteSize,
            requiredMetadata: {
                ownerUid: session.ownerUid,
                organizationId: session.organizationId,
                projectId: session.projectId,
                sessionId: session.sessionId,
                uploadSessionId: session.uploadSessionId,
            },
        },
    };
}

export const createVideoSession = onCall(
    { timeoutSeconds: 30, memory: '256MiB', enforceAppCheck: false },
    async (request): Promise<CreateVideoSessionResult> => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication is required to create a video session.');
        }

        return createOwnedVideoSession(request.auth.uid, request.data, {
            store: createFirestoreVideoSessionClaimStore(),
            bucketName: getStorage().bucket().name,
            now: () => new Date(),
            estimateCost: ({ expectedByteSize }) => estimateSessionProxyCost(expectedByteSize, process.env),
            authorizeProject: assertVideoSessionProjectAccess,
        });
    },
);
