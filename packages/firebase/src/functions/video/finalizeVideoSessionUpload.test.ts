import { Readable } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import { CanonicalMediaRefSchema } from '../../../../shared/src/schemas/sessionMedia';

vi.mock('firebase-functions/v2/storage', () => ({
    onObjectFinalized: vi.fn((_options, handler) => handler),
}));

import {
    finalizeStagedVideoUpload,
    isPermanentFinalizationFailure,
    finalizationFailureRecord,
    VIDEO_SESSION_UPLOAD_TRIGGER_OPTIONS,
} from './finalizeVideoSessionUpload';

describe('finalizeStagedVideoUpload', () => {
    it('binds the event trigger to the private production bucket without ambient Firebase config', () => {
        expect(VIDEO_SESSION_UPLOAD_TRIGGER_OPTIONS).toMatchObject({
            bucket: 'indii-music-founder.firebasestorage.app',
            timeoutSeconds: 540,
        });
    });

    /**
     * Regression: ISSUE-1210. Cloud Functions v2 event triggers have retries
     * DISABLED by default. Without `retry: true` a thrown error drops the event
     * silently — the platform logs 200 OK — so every idempotency guard in this
     * file was unreachable and a transient fault left the user's uploaded
     * original unpromoted with the session stuck at `uploading` forever.
     * This assertion exists so removing the option fails loudly.
     * Found by /qa on 2026-07-22 while scoping repair-order step 2.
     * Report: .agent/test_ledger/OPEN_ISSUES_V2.md (ISSUE-1210)
     */
    it('enables retry, without which no redelivery ever happens and idempotency is dead code', () => {
        expect(VIDEO_SESSION_UPLOAD_TRIGGER_OPTIONS.retry).toBe(true);
    });

    describe('failure classification (ISSUE-1210)', () => {
        it.each([
            'invalid-argument',
            'permission-denied',
            'failed-precondition',
            'data-loss',
        ])('treats %s as permanent — retrying for 24h cannot help', (code) => {
            expect(isPermanentFinalizationFailure({ code })).toBe(true);
        });

        it('treats not-found as transient — the Storage event can outrun the session document', () => {
            expect(isPermanentFinalizationFailure({ code: 'not-found' })).toBe(false);
        });

        it.each([
            new Error('ECONNRESET'),
            { code: 'unavailable' },
            { code: 503 },
            undefined,
        ])('treats an unrecognised fault as transient so it is redelivered, not dropped', (error) => {
            expect(isPermanentFinalizationFailure(error)).toBe(false);
        });

        it('records a failure the session schema will accept', () => {
            const record = finalizationFailureRecord(
                Object.assign(new Error('Uploaded object identity does not match its authorized session.'), {
                    code: 'permission-denied',
                }),
            );
            expect(record).toEqual({
                code: 'permission-denied',
                message: 'Uploaded object identity does not match its authorized session.',
                retryable: false,
            });
        });

        it('never emits an empty message, which the schema rejects', () => {
            expect(finalizationFailureRecord(new Error('')).message).toBe('Finalization failed.');
            expect(finalizationFailureRecord(undefined).message.length).toBeGreaterThan(0);
        });
    });

    it('hashes one generation, promotes it once, and returns an immutable owner-bound original receipt', async () => {
        const bytes = Buffer.from('immutable phone recording bytes');
        const sessionId = 'a'.repeat(40);
        const stagingPath = `session-media/artist-1/${sessionId}/staging/original.mov`;
        const promotions: Array<Record<string, unknown>> = [];
        const updates: Array<Record<string, unknown>> = [];

        const result = await finalizeStagedVideoUpload({
            bucket: 'private-media-bucket',
            path: stagingPath,
            generation: '1712345678901234',
            size: bytes.length,
            contentType: 'video/quicktime',
            createdAt: '2026-07-21T18:10:00.000Z',
            metadata: {
                ownerUid: 'artist-1',
                organizationId: 'org-1',
                projectId: 'project-1',
                sessionId,
                uploadSessionId: `upload-${sessionId}`,
            },
        }, {
            sessions: {
                async get() {
                    return {
                        schemaVersion: 'video-session.v1',
                        sessionId,
                        ownerUid: 'artist-1',
                        organizationId: 'org-1',
                        projectId: 'project-1',
                        uploadSessionId: `upload-${sessionId}`,
                        expectedMimeType: 'video/quicktime',
                        expectedByteSize: bytes.length,
                        stagingBucket: 'private-media-bucket',
                        stagingPath,
                        status: 'uploading',
                    };
                },
                async markUploaded(_id, update) {
                    updates.push(update);
                    return { original: update.original, reused: false };
                },
                async markFailed() {
                    throw new Error('a successful finalization must not record a failure');
                },
            },
            objects: {
                openGeneration() {
                    return Readable.from(bytes);
                },
                async promoteImmutable(input) {
                    promotions.push(input);
                    return { generation: '1712345678902000', created: true };
                },
            },
        });

        expect(CanonicalMediaRefSchema.safeParse(result.original).success).toBe(true);
        expect(result.original).toMatchObject({
            role: 'original',
            ownerUid: 'artist-1',
            path: expect.stringMatching(new RegExp(`^session-media/artist-1/${sessionId}/original/[a-f0-9]{64}\\.mov$`)),
            generation: '1712345678902000',
            byteSize: bytes.length,
        });
        expect(promotions).toHaveLength(1);
        expect(promotions[0]).toMatchObject({
            sourcePath: stagingPath,
            sourceGeneration: '1712345678901234',
            ifDestinationGenerationMatch: 0,
        });
        expect(updates).toHaveLength(1);
    });

    it('reuses the exact finalized generation without reopening or promoting bytes', async () => {
        const sessionId = 'b'.repeat(40);
        const stagingPath = `session-media/artist-1/${sessionId}/staging/original.mp4`;
        const original = {
            schemaVersion: 'canonical-media-ref.v1' as const,
            role: 'original' as const,
            ownerUid: 'artist-1',
            organizationId: 'org-1',
            projectId: 'project-1',
            bucket: 'private-media-bucket',
            path: `session-media/artist-1/${sessionId}/original/${'c'.repeat(64)}.mp4`,
            generation: '1712345678902000',
            sha256: 'c'.repeat(64),
            mimeType: 'video/mp4',
            byteSize: 10,
            createdAt: '2026-07-21T18:10:00.000Z',
            creationReceiptId: 'original-receipt-1',
        };

        const result = await finalizeStagedVideoUpload({
            bucket: 'private-media-bucket',
            path: stagingPath,
            generation: '1712345678901234',
            size: 10,
            contentType: 'video/mp4',
            createdAt: '2026-07-21T18:10:00.000Z',
            metadata: {
                ownerUid: 'artist-1',
                organizationId: 'org-1',
                projectId: 'project-1',
                sessionId,
                uploadSessionId: `upload-${sessionId}`,
            },
        }, {
            sessions: {
                async get() {
                    return {
                        sessionId,
                        ownerUid: 'artist-1',
                        organizationId: 'org-1',
                        projectId: 'project-1',
                        uploadSessionId: `upload-${sessionId}`,
                        expectedMimeType: 'video/mp4',
                        expectedByteSize: 10,
                        stagingBucket: 'private-media-bucket',
                        stagingPath,
                        stagingGeneration: '1712345678901234',
                        status: 'uploaded',
                        original,
                    };
                },
                async markUploaded() {
                    throw new Error('stored receipt must be reused');
                },
                async markFailed() {
                    throw new Error('a reused finalization must not record a failure');
                },
            },
            objects: {
                openGeneration() {
                    throw new Error('bytes must not be reopened');
                },
                async promoteImmutable() {
                    throw new Error('bytes must not be promoted again');
                },
            },
        });

        expect(result).toEqual({ original, reused: true });
    });
});
