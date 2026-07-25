import { describe, expect, it, vi } from 'vitest';
import {
    cleanupOneVideoSession,
    createVideoSessionDependencyChecker,
    retentionCompletionFields,
    type RetentionVideoSession,
} from './cleanupVideoSessions';

vi.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: vi.fn((_options, handler) => handler),
}));

const sessionId = 'a'.repeat(40);
const ownerUid = 'artist-1';
const prefix = `session-media/${ownerUid}/${sessionId}`;
const original = {
    ownerUid,
    bucket: 'private-media-bucket',
    path: `${prefix}/original/${'b'.repeat(64)}.mov`,
    generation: '1001',
    sha256: 'b'.repeat(64),
};
const ref = (name: string, generation: string) => ({
    ownerUid,
    bucket: 'private-media-bucket',
    path: `${prefix}/proxy/proxy-job-1/${name}`,
    generation,
    sha256: 'c'.repeat(64),
});

function completedSession(): RetentionVideoSession {
    return {
        sessionId,
        ownerUid,
        status: 'completed',
        retentionDeleteAfter: '2026-07-01T00:00:00.000Z',
        stagingBucket: 'private-media-bucket',
        stagingPath: `${prefix}/staging/original.mov`,
        original,
        proxyJob: { jobId: 'proxy-job-1' },
        proxyManifest: {
            original,
            proxy: ref('proxy.mp4', '2001'),
            guideAudio: ref('guide.wav', '2002'),
            waveform: ref('waveform.json', '2003'),
            thumbnails: [ref('thumbnail-1.jpg', '2004')],
            contactSheet: ref('contact-sheet.jpg', '2005'),
        },
    };
}

describe('cleanupOneVideoSession', () => {
    it('deletes only staging and derivatives, preserving the immutable original identity', async () => {
        const deletes: string[] = [];
        const complete = vi.fn().mockResolvedValue(undefined);
        const result = await cleanupOneVideoSession(
            completedSession(),
            'retention-receipt-1',
            new Date('2026-07-24T00:00:00.000Z'),
            {
                objects: {
                    async deleteObject(bucket, path, generation) {
                        deletes.push(`gs://${bucket}/${path}${generation ? `#${generation}` : ''}`);
                    },
                    async deletePrefix() {
                        throw new Error('completed sessions use manifest-bound object identities');
                    },
                },
                dependencyChecker: { async hasDependencies() { return false; } },
                complete,
            },
        );

        expect(result.derivativesDeferred).toBe(false);
        expect(deletes).toHaveLength(6);
        expect(deletes.some(path => path.includes('/staging/'))).toBe(true);
        expect(deletes.some(path => path.includes('/proxy/'))).toBe(true);
        expect(deletes.every(path => path !== `gs://${original.bucket}/${original.path}#${original.generation}`)).toBe(true);
        expect(complete).toHaveBeenCalledWith(
            sessionId,
            'retention-receipt-1',
            expect.objectContaining({
                preservedOriginal: {
                    bucket: original.bucket,
                    path: original.path,
                    generation: original.generation,
                    sha256: original.sha256,
                },
            }),
        );
    });

    it('defers every derivative when a downstream timeline or operation references the proxy', async () => {
        const deletes: string[] = [];
        const complete = vi.fn().mockResolvedValue(undefined);
        const result = await cleanupOneVideoSession(
            completedSession(),
            'retention-receipt-1',
            new Date('2026-07-24T00:00:00.000Z'),
            {
                objects: {
                    async deleteObject(_bucket, path) { deletes.push(path); },
                    async deletePrefix() { return []; },
                },
                dependencyChecker: { async hasDependencies() { return true; } },
                complete,
            },
        );

        expect(result).toEqual({
            deletedPaths: [`gs://private-media-bucket/${prefix}/staging/original.mov`],
            derivativesDeferred: true,
        });
        expect(deletes).toEqual([`${prefix}/staging/original.mov`]);
        expect(complete).toHaveBeenCalledWith(
            sessionId,
            'retention-receipt-1',
            expect.objectContaining({ derivativesDeferred: true }),
        );
    });
});

describe('retentionCompletionFields', () => {
    it('rechecks dependency-deferred derivatives instead of falsely satisfying retention', () => {
        const update = retentionCompletionFields(
            {
                receiptId: 'retention-receipt-1',
                startedAt: '2026-07-24T00:00:00.000Z',
            },
            {
                completedAt: '2026-07-24T01:00:00.000Z',
                deletedPaths: [`gs://private-media-bucket/${prefix}/staging/original.mov`],
                derivativesDeferred: true,
            },
        );

        expect(update).toMatchObject({
            retentionCleanup: {
                status: 'deferred',
                derivativesDeferred: true,
            },
            retentionDeleteAfter: '2026-07-25T01:00:00.000Z',
            updatedAt: '2026-07-24T01:00:00.000Z',
        });
        expect(update).not.toHaveProperty('retentionSatisfiedAt');
    });

    it('marks retention satisfied only after eligible derivatives are deleted', () => {
        const update = retentionCompletionFields(
            {
                receiptId: 'retention-receipt-1',
                startedAt: '2026-07-24T00:00:00.000Z',
            },
            {
                completedAt: '2026-07-24T01:00:00.000Z',
                deletedPaths: [],
                derivativesDeferred: false,
            },
        );

        expect(update).toMatchObject({
            retentionCleanup: { status: 'completed', derivativesDeferred: false },
            retentionDeleteAfter: '9999-12-31T23:59:59.999Z',
            retentionSatisfiedAt: '2026-07-24T01:00:00.000Z',
        });
    });
});

describe('createVideoSessionDependencyChecker', () => {
    it('bounds legacy timeline reads and defers deletion when the result is incomplete', async () => {
        const referenceGet = vi.fn().mockResolvedValue({ empty: true });
        const projectGet = vi.fn().mockResolvedValue({
            docs: Array.from({ length: 101 }, () => ({ data: () => ({ clips: [] }) })),
        });
        const projectQuery = {
            select: vi.fn(),
            limit: vi.fn(),
            get: projectGet,
        };
        projectQuery.select.mockReturnValue(projectQuery);
        projectQuery.limit.mockReturnValue(projectQuery);
        const db = {
            collection: vi.fn((collectionName: string) => {
                if (collectionName === 'videoSessionDependencies') {
                    return {
                        doc: () => ({
                            collection: () => ({
                                limit: () => ({ get: referenceGet }),
                            }),
                        }),
                    };
                }
                return {
                    doc: () => ({
                        collection: () => projectQuery,
                    }),
                };
            }),
        };

        const checker = createVideoSessionDependencyChecker(
            db as unknown as FirebaseFirestore.Firestore,
        );
        await expect(checker.hasDependencies(completedSession())).resolves.toBe(true);
        expect(projectQuery.select).toHaveBeenCalledWith('project.clips', 'clips');
        expect(projectQuery.limit).toHaveBeenCalledWith(101);
        expect(projectGet).toHaveBeenCalledTimes(1);
    });
});
