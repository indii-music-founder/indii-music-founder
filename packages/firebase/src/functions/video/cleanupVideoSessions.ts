import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onSchedule } from 'firebase-functions/v2/scheduler';

type TerminalStatus = 'completed' | 'failed' | 'cancelled';

interface StoredObjectRef {
    ownerUid: string;
    bucket: string;
    path: string;
    generation: string;
    sha256: string;
}

export interface RetentionVideoSession {
    sessionId: string;
    ownerUid: string;
    status: TerminalStatus;
    retentionDeleteAfter: string;
    stagingBucket: string;
    stagingPath: string;
    original?: StoredObjectRef;
    proxyJob?: { jobId?: string };
    proxyManifest?: {
        original: StoredObjectRef;
        proxy: StoredObjectRef;
        guideAudio: StoredObjectRef;
        waveform: StoredObjectRef;
        thumbnails: StoredObjectRef[];
        contactSheet?: StoredObjectRef;
    };
}

export interface VideoSessionRetentionStore {
    listEligible(nowIso: string): Promise<string[]>;
    claim(sessionId: string, nowIso: string, receiptId: string): Promise<RetentionVideoSession | undefined>;
    complete(sessionId: string, receiptId: string, audit: {
        completedAt: string;
        deletedPaths: string[];
        derivativesDeferred: boolean;
        preservedOriginal?: Pick<StoredObjectRef, 'bucket' | 'path' | 'generation' | 'sha256'>;
    }): Promise<void>;
}

export interface VideoSessionObjectCleanup {
    deleteObject(bucket: string, path: string, generation?: string): Promise<void>;
    deletePrefix(bucket: string, prefix: string): Promise<string[]>;
}

export interface VideoSessionDependencyChecker {
    hasDependencies(session: RetentionVideoSession): Promise<boolean>;
}

const DEPENDENCY_RECHECK_MS = 24 * 60 * 60 * 1000;
const LEGACY_PROJECT_SCAN_LIMIT = 100;

interface RetentionCompletionUpdate {
    retentionCleanup: {
        schemaVersion: 'video-session-retention.v1';
        status: 'deferred' | 'completed';
        receiptId: unknown;
        startedAt: unknown;
        completedAt: string;
        deletedPaths: string[];
        derivativesDeferred: boolean;
        preservedOriginal?: Pick<StoredObjectRef, 'bucket' | 'path' | 'generation' | 'sha256'>;
    };
    retentionDeleteAfter: string;
    retentionSatisfiedAt?: string;
    updatedAt: string;
}

export function retentionCompletionFields(
    cleanup: Record<string, unknown>,
    audit: {
        completedAt: string;
        deletedPaths: string[];
        derivativesDeferred: boolean;
        preservedOriginal?: Pick<StoredObjectRef, 'bucket' | 'path' | 'generation' | 'sha256'>;
    },
): RetentionCompletionUpdate {
    if (audit.derivativesDeferred) {
        return {
            retentionCleanup: {
                schemaVersion: 'video-session-retention.v1',
                status: 'deferred',
                receiptId: cleanup.receiptId,
                startedAt: cleanup.startedAt,
                ...audit,
            },
            retentionDeleteAfter: new Date(
                Date.parse(audit.completedAt) + DEPENDENCY_RECHECK_MS,
            ).toISOString(),
            updatedAt: audit.completedAt,
        };
    }
    return {
        retentionCleanup: {
            schemaVersion: 'video-session-retention.v1',
            status: 'completed',
            receiptId: cleanup.receiptId,
            startedAt: cleanup.startedAt,
            ...audit,
        },
        // Remove this completed receipt from the due-date scan while
        // preserving the original object and the cleanup audit.
        retentionDeleteAfter: '9999-12-31T23:59:59.999Z',
        retentionSatisfiedAt: audit.completedAt,
        updatedAt: audit.completedAt,
    };
}

function sessionPrefix(session: RetentionVideoSession): string {
    return `session-media/${session.ownerUid}/${session.sessionId}/`;
}

function validateSessionIdentity(session: RetentionVideoSession): void {
    if (
        !/^[a-f0-9]{40}$/.test(session.sessionId)
        || !session.ownerUid
        || !['completed', 'failed', 'cancelled'].includes(session.status)
        || !session.stagingPath.startsWith(`${sessionPrefix(session)}staging/`)
    ) {
        throw new Error(`Video session ${session.sessionId} has malformed retention identity`);
    }
}

function derivedRefs(session: RetentionVideoSession): StoredObjectRef[] {
    const manifest = session.proxyManifest;
    if (!manifest) return [];
    const refs = [
        manifest.proxy,
        manifest.guideAudio,
        manifest.waveform,
        ...manifest.thumbnails,
        ...(manifest.contactSheet ? [manifest.contactSheet] : []),
    ];
    const expectedPrefix = `${sessionPrefix(session)}proxy/`;
    for (const ref of refs) {
        if (
            ref.ownerUid !== session.ownerUid
            || !ref.path.startsWith(expectedPrefix)
            || ref.path === manifest.original.path
        ) {
            throw new Error(`Video session ${session.sessionId} has a malformed derivative identity`);
        }
    }
    return refs;
}

export async function cleanupOneVideoSession(
    session: RetentionVideoSession,
    receiptId: string,
    now: Date,
    dependencies: {
        objects: VideoSessionObjectCleanup;
        dependencyChecker: VideoSessionDependencyChecker;
        complete: VideoSessionRetentionStore['complete'];
    },
): Promise<{ deletedPaths: string[]; derivativesDeferred: boolean }> {
    validateSessionIdentity(session);
    const deletedPaths: string[] = [];

    await dependencies.objects.deleteObject(session.stagingBucket, session.stagingPath);
    deletedPaths.push(`gs://${session.stagingBucket}/${session.stagingPath}`);

    let derivativesDeferred = false;
    if (session.status === 'completed') {
        derivativesDeferred = await dependencies.dependencyChecker.hasDependencies(session);
        if (!derivativesDeferred) {
            for (const ref of derivedRefs(session)) {
                await dependencies.objects.deleteObject(ref.bucket, ref.path, ref.generation);
                deletedPaths.push(`gs://${ref.bucket}/${ref.path}#${ref.generation}`);
            }
        }
    } else if (session.proxyJob?.jobId) {
        const prefix = `${sessionPrefix(session)}proxy/${session.proxyJob.jobId}/`;
        const removed = await dependencies.objects.deletePrefix(
            session.original?.bucket ?? session.stagingBucket,
            prefix,
        );
        deletedPaths.push(...removed);
    }

    const original = session.original ?? session.proxyManifest?.original;
    await dependencies.complete(session.sessionId, receiptId, {
        completedAt: now.toISOString(),
        deletedPaths,
        derivativesDeferred,
        ...(original ? {
            preservedOriginal: {
                bucket: original.bucket,
                path: original.path,
                generation: original.generation,
                sha256: original.sha256,
            },
        } : {}),
    });
    return { deletedPaths, derivativesDeferred };
}

export function createFirestoreVideoSessionRetentionStore(
    db: FirebaseFirestore.Firestore = getFirestore(),
): VideoSessionRetentionStore {
    return {
        async listEligible(nowIso) {
            const snapshot = await db.collection('videoSessions')
                .where('retentionDeleteAfter', '<=', nowIso)
                .orderBy('retentionDeleteAfter', 'asc')
                .limit(100)
                .get();
            return snapshot.docs.map(document => document.id);
        },
        async claim(sessionId, nowIso, receiptId) {
            const reference = db.collection('videoSessions').doc(sessionId);
            return db.runTransaction(async transaction => {
                const snapshot = await transaction.get(reference);
                if (!snapshot.exists) return undefined;
                const session = snapshot.data() as Record<string, unknown>;
                if (
                    typeof session.retentionDeleteAfter !== 'string'
                    || session.retentionDeleteAfter > nowIso
                ) {
                    return undefined;
                }
                const status = String(session.status);
                if (!['uploading', 'uploaded', 'processing', 'completed', 'failed', 'cancelled'].includes(status)) {
                    return undefined;
                }
                const cleanup = session.retentionCleanup as Record<string, unknown> | undefined;
                if (cleanup?.status === 'completed') return undefined;
                if (cleanup?.status === 'running' && cleanup.receiptId !== receiptId) return undefined;
                const expiredActive = ['uploading', 'uploaded', 'processing'].includes(status);
                const terminalReceiptId = `retention-cancel-${createHash('sha256')
                    .update(sessionId)
                    .digest('hex')
                    .slice(0, 48)}`;
                transaction.update(reference, {
                    ...(expiredActive ? {
                        status: 'cancelled',
                        cancelledAt: nowIso,
                        terminalReceiptId,
                    } : {}),
                    retentionCleanup: {
                        schemaVersion: 'video-session-retention.v1',
                        status: 'running',
                        receiptId,
                        startedAt: nowIso,
                    },
                    updatedAt: nowIso,
                });
                return {
                    ...session,
                    ...(expiredActive ? {
                        status: 'cancelled',
                        cancelledAt: nowIso,
                        terminalReceiptId,
                    } : {}),
                } as unknown as RetentionVideoSession;
            });
        },
        async complete(sessionId, receiptId, audit) {
            const reference = db.collection('videoSessions').doc(sessionId);
            await db.runTransaction(async transaction => {
                const snapshot = await transaction.get(reference);
                const cleanup = snapshot.data()?.retentionCleanup as Record<string, unknown> | undefined;
                if (cleanup?.status === 'completed' && cleanup.receiptId === receiptId) return;
                if (cleanup?.status !== 'running' || cleanup.receiptId !== receiptId) {
                    throw new Error(`Retention receipt ${receiptId} no longer owns session ${sessionId}`);
                }
                const completion = retentionCompletionFields(cleanup, audit);
                transaction.update(reference, {
                    retentionCleanup: completion.retentionCleanup,
                    retentionDeleteAfter: completion.retentionDeleteAfter,
                    ...(completion.retentionSatisfiedAt
                        ? { retentionSatisfiedAt: completion.retentionSatisfiedAt }
                        : {}),
                    updatedAt: completion.updatedAt,
                });
            });
        },
    };
}

export function createGcsVideoSessionObjectCleanup(
    storage: ReturnType<typeof getStorage> = getStorage(),
): VideoSessionObjectCleanup {
    const ignoreMissing = (error: unknown) => {
        const code = Number(error && typeof error === 'object' && 'code' in error
            ? (error as { code?: unknown }).code
            : undefined);
        if (code !== 404) throw error;
    };
    return {
        async deleteObject(bucket, path, generation) {
            try {
                await storage.bucket(bucket).file(path).delete({
                    ...(generation ? { ifGenerationMatch: Number(generation) } : {}),
                });
            } catch (error) {
                ignoreMissing(error);
            }
        },
        async deletePrefix(bucket, prefix) {
            const [files] = await storage.bucket(bucket).getFiles({ prefix });
            const deleted: string[] = [];
            for (const file of files) {
                try {
                    await file.delete({ ifGenerationMatch: Number(file.metadata.generation) });
                    deleted.push(`gs://${bucket}/${file.name}#${String(file.metadata.generation)}`);
                } catch (error) {
                    ignoreMissing(error);
                }
            }
            return deleted;
        },
    };
}

export function createVideoSessionDependencyChecker(
    db: FirebaseFirestore.Firestore = getFirestore(),
): VideoSessionDependencyChecker {
    return {
        async hasDependencies(session) {
            const registered = await db.collection('videoSessionDependencies')
                .doc(session.sessionId)
                .collection('references')
                .limit(1)
                .get();
            if (!registered.empty) return true;

            const proxyGeneration = session.proxyManifest?.proxy.generation;
            if (!proxyGeneration) return false;
            const projects = await db.collection('users')
                .doc(session.ownerUid)
                .collection('videoProjects')
                .select('project.clips', 'clips')
                .limit(LEGACY_PROJECT_SCAN_LIMIT + 1)
                .get();
            // Dependency receipts are authoritative for new consumers. The
            // bounded legacy scan protects timelines saved before receipts
            // existed; if the owner exceeds the bound, defer deletion rather
            // than guess that an unseen project is safe.
            if (projects.docs.length > LEGACY_PROJECT_SCAN_LIMIT) return true;
            return projects.docs.some(document => {
                const clips = document.data()?.project?.clips ?? document.data()?.clips;
                return Array.isArray(clips)
                    && clips.some(clip => clip && typeof clip === 'object'
                        && (clip as Record<string, unknown>).proxyGeneration === proxyGeneration);
            });
        },
    };
}

export async function cleanupExpiredVideoSessionsAt(
    now: Date,
    dependencies: {
        store: VideoSessionRetentionStore;
        objects: VideoSessionObjectCleanup;
        dependencyChecker: VideoSessionDependencyChecker;
    },
): Promise<number> {
    const nowIso = now.toISOString();
    const sessionIds = await dependencies.store.listEligible(nowIso);
    let completed = 0;
    for (const sessionId of sessionIds) {
        const receiptId = `retention-${createHash('sha256')
            .update(sessionId)
            .digest('hex')
            .slice(0, 48)}`;
        const session = await dependencies.store.claim(sessionId, nowIso, receiptId);
        if (!session) continue;
        await cleanupOneVideoSession(session, receiptId, now, {
            objects: dependencies.objects,
            dependencyChecker: dependencies.dependencyChecker,
            complete: dependencies.store.complete.bind(dependencies.store),
        });
        completed += 1;
    }
    return completed;
}

export const cleanupExpiredVideoSessions = onSchedule(
    {
        schedule: 'every 24 hours',
        timeZone: 'Etc/UTC',
        region: 'us-central1',
        retryCount: 3,
    },
    async () => {
        await cleanupExpiredVideoSessionsAt(new Date(), {
            store: createFirestoreVideoSessionRetentionStore(),
            objects: createGcsVideoSessionObjectCleanup(),
            dependencyChecker: createVideoSessionDependencyChecker(),
        });
    },
);
