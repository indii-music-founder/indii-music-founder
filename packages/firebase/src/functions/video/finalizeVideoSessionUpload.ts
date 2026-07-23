import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { z } from 'zod';

import { dispatchSessionProxyJob } from './dispatchSessionProxyJob';

const SESSION_UPLOAD_PATH = /^session-media\/([^/]+)\/([a-f0-9]{40})\/staging\/original\.(mp4|mov|webm|m4v)$/;
const NUMERIC_GENERATION = /^[1-9][0-9]*$/;

const StagedUploadEventSchema = z.object({
    bucket: z.string().trim().min(3).max(222),
    path: z.string().trim().min(1).max(1024),
    generation: z.string().regex(NUMERIC_GENERATION),
    size: z.number().int().positive(),
    contentType: z.enum(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']),
    createdAt: z.string().datetime(),
    metadata: z.object({
        ownerUid: z.string().trim().min(1).max(256),
        organizationId: z.string().trim().min(1).max(256),
        projectId: z.string().trim().min(1).max(256),
        sessionId: z.string().regex(/^[a-f0-9]{40}$/),
        uploadSessionId: z.string().trim().min(1).max(256),
    }).passthrough(),
}).strict();

export interface FinalizedOriginalRef {
    schemaVersion: 'canonical-media-ref.v1';
    role: 'original';
    ownerUid: string;
    organizationId: string;
    projectId: string;
    bucket: string;
    path: string;
    generation: string;
    sha256: string;
    mimeType: string;
    byteSize: number;
    createdAt: string;
    creationReceiptId: string;
}

interface UploadSessionRecord {
    sessionId: string;
    ownerUid: string;
    organizationId: string;
    projectId: string;
    uploadSessionId: string;
    expectedMimeType: string;
    expectedByteSize: number;
    stagingBucket: string;
    stagingPath: string;
    status: string;
    stagingGeneration?: string;
    original?: FinalizedOriginalRef;
}

export interface SessionFailureRecord {
    code: string;
    message: string;
    retryable: false;
}

export interface VideoSessionFinalizationStore {
    get(sessionId: string): Promise<unknown>;
    markUploaded(sessionId: string, update: {
        original: FinalizedOriginalRef;
        stagingGeneration: string;
        status: 'uploaded';
        updatedAt: string;
    }): Promise<{ original: FinalizedOriginalRef; reused: boolean }>;
    /**
     * Record a permanent finalization failure as a terminal state (ISSUE-1210).
     * Only reachable for errors that can never succeed on retry — a transient
     * fault must be rethrown so Eventarc redelivers instead.
     */
    markFailed(sessionId: string, update: {
        status: 'failed';
        failure: SessionFailureRecord;
        failedAt: string;
        terminalReceiptId: string;
        updatedAt: string;
    }): Promise<{ reused: boolean }>;
}

export interface ImmutableVideoObjectStore {
    openGeneration(input: {
        bucket: string;
        path: string;
        generation: string;
    }): NodeJS.ReadableStream;
    promoteImmutable(input: {
        bucket: string;
        sourcePath: string;
        sourceGeneration: string;
        destinationPath: string;
        ifDestinationGenerationMatch: 0;
        contentType: string;
        metadata: Record<string, string>;
    }): Promise<{ generation: string; created: boolean }>;
}

interface FinalizeStagedVideoUploadDependencies {
    sessions: VideoSessionFinalizationStore;
    objects: ImmutableVideoObjectStore;
}

export function createFirestoreVideoSessionFinalizationStore(
    db: FirebaseFirestore.Firestore = getFirestore(),
): VideoSessionFinalizationStore {
    return {
        async get(sessionId) {
            const snapshot = await db.collection('videoSessions').doc(sessionId).get();
            return snapshot.exists ? snapshot.data() : undefined;
        },
        async markUploaded(sessionId, update) {
            const sessionRef = db.collection('videoSessions').doc(sessionId);
            return db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(sessionRef);
                if (!snapshot.exists) {
                    throw new HttpsError('not-found', 'The video upload session no longer exists.');
                }
                const current = snapshot.data() as Record<string, unknown>;
                if (current.stagingGeneration === update.stagingGeneration && current.original) {
                    return { original: current.original as FinalizedOriginalRef, reused: true };
                }
                if (current.original || !['uploading', 'uploaded'].includes(String(current.status))) {
                    throw new HttpsError('failed-precondition', 'A different original is already bound to this session.');
                }
                transaction.update(sessionRef, update);
                return { original: update.original, reused: false };
            });
        },
        async markFailed(sessionId, update) {
            const sessionRef = db.collection('videoSessions').doc(sessionId);
            return db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(sessionRef);
                if (!snapshot.exists) return { reused: true };
                const current = snapshot.data() as Record<string, unknown>;
                // Never overwrite a session that already reached a terminal or
                // successful state — a late permanent failure must not erase a
                // finalized original or a prior cancellation receipt.
                if (current.original || ['failed', 'cancelled', 'completed'].includes(String(current.status))) {
                    return { reused: true };
                }
                transaction.update(sessionRef, update);
                return { reused: false };
            });
        },
    };
}

function storageErrorCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
    const code = Number((error as { code?: unknown }).code);
    return Number.isFinite(code) ? code : undefined;
}

export function createGcsImmutableVideoObjectStore(
    storage: ReturnType<typeof getStorage> = getStorage(),
): ImmutableVideoObjectStore {
    return {
        openGeneration({ bucket, path, generation }) {
            return storage.bucket(bucket).file(path, { generation }).createReadStream();
        },
        async promoteImmutable(input) {
            const bucket = storage.bucket(input.bucket);
            const source = bucket.file(input.sourcePath, { generation: input.sourceGeneration });
            const destination = bucket.file(input.destinationPath);
            try {
                const [copied] = await source.copy(destination, {
                    contentType: input.contentType,
                    metadata: input.metadata,
                    preconditionOpts: { ifGenerationMatch: input.ifDestinationGenerationMatch },
                });
                const [metadata] = await copied.getMetadata();
                return { generation: String(metadata.generation ?? ''), created: true };
            } catch (error: unknown) {
                if (![409, 412].includes(storageErrorCode(error) ?? 0)) throw error;
                const [metadata] = await destination.getMetadata();
                const customMetadata = metadata.metadata ?? {};
                if (
                    customMetadata.sha256 !== input.metadata.sha256
                    || customMetadata.sourceGeneration !== input.sourceGeneration
                    || customMetadata.immutable !== 'true'
                ) {
                    throw new HttpsError('data-loss', 'Existing original destination does not match this upload generation.');
                }
                return { generation: String(metadata.generation ?? ''), created: false };
            }
        },
    };
}

function parseUploadSession(raw: unknown): UploadSessionRecord {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new HttpsError('not-found', 'The video upload session does not exist.');
    }
    const session = raw as Record<string, unknown>;
    const requiredStrings = [
        'sessionId', 'ownerUid', 'organizationId', 'projectId', 'uploadSessionId',
        'expectedMimeType', 'stagingBucket', 'stagingPath', 'status',
    ];
    if (
        requiredStrings.some((field) => typeof session[field] !== 'string' || !(session[field] as string).trim())
        || !Number.isInteger(session.expectedByteSize)
        || Number(session.expectedByteSize) <= 0
    ) {
        throw new HttpsError('data-loss', 'The stored video upload session is malformed.');
    }
    return session as unknown as UploadSessionRecord;
}

function assertEventMatchesSession(
    event: z.infer<typeof StagedUploadEventSchema>,
    session: UploadSessionRecord,
    pathOwnerUid: string,
    pathSessionId: string,
): void {
    if (
        session.sessionId !== pathSessionId
        || session.ownerUid !== pathOwnerUid
        || session.ownerUid !== event.metadata.ownerUid
        || session.organizationId !== event.metadata.organizationId
        || session.projectId !== event.metadata.projectId
        || session.uploadSessionId !== event.metadata.uploadSessionId
        || session.sessionId !== event.metadata.sessionId
        || session.stagingBucket !== event.bucket
        || session.stagingPath !== event.path
    ) {
        throw new HttpsError('permission-denied', 'Uploaded object identity does not match its authorized session.');
    }
    if (session.expectedMimeType !== event.contentType || session.expectedByteSize !== event.size) {
        throw new HttpsError('failed-precondition', 'Uploaded object MIME type or byte size does not match its authorization.');
    }
}

async function streamSha256(stream: NodeJS.ReadableStream): Promise<string> {
    const hash = createHash('sha256');
    await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk) => hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.once('error', reject);
        stream.once('end', resolve);
    });
    return hash.digest('hex');
}

export async function finalizeStagedVideoUpload(
    rawEvent: unknown,
    dependencies: FinalizeStagedVideoUploadDependencies,
): Promise<{ original: FinalizedOriginalRef; reused: boolean }> {
    const parsedEvent = StagedUploadEventSchema.safeParse(rawEvent);
    if (!parsedEvent.success) {
        throw new HttpsError('invalid-argument', 'Staged upload event metadata is invalid.');
    }
    const event = parsedEvent.data;
    const pathMatch = SESSION_UPLOAD_PATH.exec(event.path);
    if (!pathMatch) {
        throw new HttpsError('invalid-argument', 'Object is not an authorized session staging upload.');
    }
    const [, pathOwnerUid, pathSessionId, extension] = pathMatch;
    if (!pathOwnerUid || !pathSessionId || !extension) {
        throw new HttpsError('invalid-argument', 'Session upload path is incomplete.');
    }

    const session = parseUploadSession(await dependencies.sessions.get(pathSessionId));
    assertEventMatchesSession(event, session, pathOwnerUid, pathSessionId);
    if (session.stagingGeneration === event.generation && session.original) {
        return { original: session.original, reused: true };
    }
    if (!['uploading', 'uploaded'].includes(session.status)) {
        throw new HttpsError('failed-precondition', `Session status ${session.status} cannot accept uploaded bytes.`);
    }

    const sha256 = await streamSha256(dependencies.objects.openGeneration({
        bucket: event.bucket,
        path: event.path,
        generation: event.generation,
    }));
    const destinationPath = `session-media/${session.ownerUid}/${session.sessionId}/original/${sha256}.${extension}`;
    const creationReceiptId = `original-${createHash('sha256')
        .update(`${event.bucket}\0${event.path}\0${event.generation}\0${sha256}`)
        .digest('hex')
        .slice(0, 48)}`;
    const promotion = await dependencies.objects.promoteImmutable({
        bucket: event.bucket,
        sourcePath: event.path,
        sourceGeneration: event.generation,
        destinationPath,
        ifDestinationGenerationMatch: 0,
        contentType: event.contentType,
        metadata: {
            ownerUid: session.ownerUid,
            organizationId: session.organizationId,
            projectId: session.projectId,
            sessionId: session.sessionId,
            sha256,
            immutable: 'true',
            sourceGeneration: event.generation,
            creationReceiptId,
        },
    });
    if (!NUMERIC_GENERATION.test(promotion.generation)) {
        throw new HttpsError('data-loss', 'Promoted original has no immutable Storage generation.');
    }

    const original: FinalizedOriginalRef = {
        schemaVersion: 'canonical-media-ref.v1',
        role: 'original',
        ownerUid: session.ownerUid,
        organizationId: session.organizationId,
        projectId: session.projectId,
        bucket: event.bucket,
        path: destinationPath,
        generation: promotion.generation,
        sha256,
        mimeType: event.contentType,
        byteSize: event.size,
        createdAt: event.createdAt,
        creationReceiptId,
    };

    return dependencies.sessions.markUploaded(session.sessionId, {
        original,
        stagingGeneration: event.generation,
        status: 'uploaded',
        updatedAt: event.createdAt,
    });
}

/**
 * HttpsError codes that can never succeed on redelivery. Everything else —
 * including `not-found`, because the Storage event can outrun the session
 * document becoming readable — is treated as transient and rethrown so Eventarc
 * redelivers it.
 */
const PERMANENT_FAILURE_CODES: ReadonlySet<string> = new Set([
    'invalid-argument',
    'permission-denied',
    'failed-precondition',
    'data-loss',
    'unauthenticated',
    'already-exists',
]);

export function isPermanentFinalizationFailure(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('code' in error)) return false;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && PERMANENT_FAILURE_CODES.has(code);
}

export function finalizationFailureRecord(error: unknown): SessionFailureRecord {
    const code = typeof (error as { code?: unknown })?.code === 'string'
        ? String((error as { code: string }).code)
        : 'unknown';
    const message = error instanceof Error ? error.message : String(error);
    return { code, message: message.slice(0, 2000) || 'Finalization failed.', retryable: false };
}

export const VIDEO_SESSION_UPLOAD_TRIGGER_OPTIONS = {
    bucket: 'indii-music-founder.firebasestorage.app',
    timeoutSeconds: 540,
    memory: '1GiB',
    region: 'us-central1',
    // ISSUE-1210: Cloud Functions v2 event triggers have retries DISABLED by
    // default. Without this, a thrown error drops the event silently — the
    // platform even logs 200 OK — so a transient GCS or Firestore fault left the
    // user's uploaded original unpromoted and the session stuck at `uploading`
    // forever, with no error anywhere. Every idempotency guard in this file
    // (generation pinning, ifGenerationMatch: 0, the `reused` short-circuits)
    // was unreachable because nothing was ever redelivered.
    // Retries are only safe because permanent failures are now classified and
    // swallowed into a terminal `failed` state below — otherwise a malformed
    // event would grind for the full 24h retry window.
    retry: true,
} as const;

export const finalizeVideoSessionUpload = onObjectFinalized(
    VIDEO_SESSION_UPLOAD_TRIGGER_OPTIONS,
    async (event) => {
        const path = event.data.name;
        if (!path?.startsWith('session-media/') || !path.includes('/staging/original.')) return;

        try {
            const { original } = await finalizeStagedVideoUpload({
                bucket: event.data.bucket,
                path,
                generation: String(event.data.generation ?? ''),
                size: Number(event.data.size),
                contentType: event.data.contentType,
                createdAt: event.data.timeCreated,
                metadata: event.data.metadata ?? {},
            }, {
                sessions: createFirestoreVideoSessionFinalizationStore(),
                objects: createGcsImmutableVideoObjectStore(),
            });

            // ISSUE-1175 repair-order step 2: a finalized original is worthless
            // until something produces its proxy — `videoEditorStore` already
            // reads `session.proxyManifest`, and nothing was ever writing it, so
            // every session dead-ended at `uploaded`. Dispatch is idempotent on
            // the original's generation + SHA-256, which is what makes it safe to
            // run inside a handler Eventarc deliberately redelivers.
            const sessionId = SESSION_UPLOAD_PATH.exec(path)?.[2];
            if (sessionId) {
                const dispatch = await dispatchSessionProxyJob(sessionId, original);
                if (dispatch.status === 'blocked') {
                    logger.warn('[finalizeVideoSessionUpload] Proxy worker not provisioned; session has no proxy', {
                        sessionId,
                        jobId: dispatch.jobId,
                        reason: dispatch.blockedReason,
                    });
                }
            }
        } catch (error: unknown) {
            const permanent = isPermanentFinalizationFailure(error);
            logger.error('[finalizeVideoSessionUpload] Failed to finalize staged original', {
                bucket: event.data.bucket,
                path,
                generation: event.data.generation,
                permanent,
                error: error instanceof Error ? error.message : String(error),
            });

            if (!permanent) {
                // Transient: rethrow so Eventarc redelivers. Safe because this
                // handler is idempotent — a redelivered event that already
                // finalized returns the stored receipt without rehashing or
                // repromoting bytes.
                throw error;
            }

            // Permanent: retrying for 24h cannot help. Record an auditable
            // terminal state so the session stops sitting at `uploading` and the
            // owner can be told, then swallow the event to stop redelivery.
            const sessionId = SESSION_UPLOAD_PATH.exec(path)?.[2];
            if (sessionId) {
                const failure = finalizationFailureRecord(error);
                // timeCreated is typed `string | Date` depending on the emitter.
                const rawFailedAt = event.data.timeCreated ?? event.time;
                const failedAt = rawFailedAt instanceof Date
                    ? rawFailedAt.toISOString()
                    : new Date(rawFailedAt).toISOString();
                const terminalReceiptId = `failed-${createHash('sha256')
                    .update(`${event.data.bucket}\0${path}\0${event.data.generation ?? ''}\0${failure.code}`)
                    .digest('hex')
                    .slice(0, 48)}`;
                try {
                    await createFirestoreVideoSessionFinalizationStore().markFailed(sessionId, {
                        status: 'failed',
                        failure,
                        failedAt,
                        terminalReceiptId,
                        updatedAt: failedAt,
                    });
                } catch (markError: unknown) {
                    // Could not record the terminal state. Rethrow so the event is
                    // redelivered rather than lost — an unrecorded permanent
                    // failure is indistinguishable from the silent drop this
                    // whole change exists to remove.
                    logger.error('[finalizeVideoSessionUpload] Could not record terminal failure', {
                        sessionId,
                        error: markError instanceof Error ? markError.message : String(markError),
                    });
                    throw error;
                }
            }
        }
    },
);
