import { describe, expect, it } from 'vitest';
import { ProxyManifestSchema, ProxyJobClaimSchema, VideoSessionSchema } from './sessionMedia';
const ownedMedia = (role, path) => ({
    schemaVersion: 'canonical-media-ref.v1',
    role,
    ownerUid: 'artist-1',
    organizationId: 'org-1',
    projectId: 'project-1',
    bucket: 'private-media-bucket',
    path,
    generation: '1712345678901234',
    sha256: 'a'.repeat(64),
    mimeType: role === 'guide_audio' ? 'audio/wav' : 'video/mp4',
    byteSize: role === 'original' ? 2_000_000_000 : 250_000_000,
    createdAt: '2026-07-21T18:00:00.000Z',
    creationReceiptId: `receipt-${role}`,
});
const validManifest = {
    schemaVersion: 'proxy-manifest.v1',
    manifestId: 'manifest-1',
    sessionId: 'session-1',
    ownerUid: 'artist-1',
    organizationId: 'org-1',
    projectId: 'project-1',
    original: ownedMedia('original', 'session-media/artist-1/session-1/original.mov'),
    proxy: ownedMedia('editing_proxy', 'session-media/artist-1/session-1/proxy.mp4'),
    guideAudio: ownedMedia('guide_audio', 'session-media/artist-1/session-1/guide.wav'),
    inspection: {
        originalDurationUs: 60_020_000,
        proxyDurationUs: 60_000_000,
        sourceVideoCodec: 'hevc',
        sourceAudioCodec: 'aac',
        sourceWidth: 3840,
        sourceHeight: 2160,
        sourceRotationDegrees: 90,
        sourceFrameRateMode: 'variable',
        sourceHdr: true,
        proxyVideoCodec: 'h264',
        proxyAudioCodec: 'aac',
        proxyWidth: 720,
        proxyHeight: 1280,
        proxyFrameRateNumerator: 30,
        proxyFrameRateDenominator: 1,
        proxyColorSpace: 'rec709',
        orientationBakedIn: true,
    },
    timeMap: {
        version: 'presentation-time-map.v1',
        segments: [
            {
                proxyStartUs: 0,
                proxyEndUs: 30_000_000,
                originalStartUs: 0,
                originalEndUs: 30_010_000,
            },
            {
                proxyStartUs: 30_000_000,
                proxyEndUs: 60_000_000,
                originalStartUs: 30_010_000,
                originalEndUs: 60_020_000,
            },
        ],
    },
    waveform: {
        schemaVersion: 'derived-media-ref.v1',
        role: 'waveform',
        ownerUid: 'artist-1',
        organizationId: 'org-1',
        projectId: 'project-1',
        bucket: 'private-media-bucket',
        path: 'session-media/artist-1/session-1/waveform.json',
        generation: '1712345678901235',
        sha256: 'b'.repeat(64),
        mimeType: 'application/json',
        byteSize: 8_000,
        workerVersion: 'session-proxy-worker@1.0.0',
        createdAt: '2026-07-21T18:05:00.000Z',
        creationReceiptId: 'receipt-waveform',
    },
    thumbnails: [],
    workerVersion: 'session-proxy-worker@1.0.0',
    createdAt: '2026-07-21T18:05:00.000Z',
    processingReceiptId: 'processing-receipt-1',
};
describe('ProxyManifestSchema', () => {
    it('accepts one owner-bound immutable source, proxy, guide, and integer-microsecond time map', () => {
        expect(ProxyManifestSchema.safeParse(validManifest).success).toBe(true);
    });
    it('rejects mixed ownership and public URL identity', () => {
        const parsed = ProxyManifestSchema.safeParse({
            ...validManifest,
            proxy: {
                ...validManifest.proxy,
                ownerUid: 'artist-2',
                downloadUrl: 'https://storage.example.test/tokenized-proxy.mp4',
            },
        });
        expect(parsed.success).toBe(false);
    });
    it('rejects fractional durable time and discontinuous proxy mappings', () => {
        const parsed = ProxyManifestSchema.safeParse({
            ...validManifest,
            timeMap: {
                ...validManifest.timeMap,
                segments: [
                    validManifest.timeMap.segments[0],
                    {
                        ...validManifest.timeMap.segments[1],
                        proxyStartUs: 30_000_000.5,
                    },
                ],
            },
        });
        expect(parsed.success).toBe(false);
    });
    it('rejects mutable or malformed object identity', () => {
        expect(ProxyManifestSchema.safeParse({
            ...validManifest,
            original: {
                ...validManifest.original,
                generation: '',
                sha256: 'not-a-sha256',
            },
        }).success).toBe(false);
    });
});
describe('VideoSessionSchema', () => {
    const uploadingSession = {
        schemaVersion: 'video-session.v1',
        sessionId: 'session-1',
        ownerUid: 'artist-1',
        organizationId: 'org-1',
        projectId: 'project-1',
        idempotencyKey: 'upload-artist-1-project-1-session-1',
        uploadSessionId: 'resumable-upload-1',
        expectedMimeType: 'video/quicktime',
        expectedByteSize: 2_000_000_000,
        stagingBucket: 'private-media-bucket',
        stagingPath: 'session-media/artist-1/session-1/staging/original.mov',
        status: 'uploading',
        costEstimate: {
            currency: 'USD',
            amountMinor: 125,
            estimateVersion: 'session-proxy-cost.v1',
        },
        retentionDeleteAfter: '2026-08-21T18:00:00.000Z',
        createdAt: '2026-07-21T18:00:00.000Z',
        updatedAt: '2026-07-21T18:01:00.000Z',
    };
    it('accepts an owner-bound resumable session but rejects fabricated completion without receipts', () => {
        expect(VideoSessionSchema.safeParse(uploadingSession).success).toBe(true);
        expect(VideoSessionSchema.safeParse({
            ...uploadingSession,
            status: 'completed',
        }).success).toBe(false);
    });
    // Regression: `dispatchSessionProxyJob.ts` writes `proxyJob` onto the real
    // `videoSessions/{sessionId}` document, but this schema is `.strict()` and
    // is used to parse that same document client-side
    // (`SessionVideoUploadService.ts`). Before this field was declared, any read
    // of a session that had been dispatched — real production behaviour once a
    // session finishes uploading — would silently fail `.safeParse()`.
    // Found while scoping repair-order step 2/3 (proxy worker).
    // Report: .agent/test_ledger/OPEN_ISSUES_V2.md
    describe('proxyJob (dispatchSessionProxyJob.ts contract)', () => {
        const queuedProxyJob = {
            schemaVersion: 'session-proxy-job.v1',
            jobId: 'proxy-abc123',
            status: 'queued',
            originalGeneration: '1712345678901234',
            originalSha256: 'a'.repeat(64),
            claimedAt: '2026-07-23T18:00:00.000Z',
        };
        const dispatchedSession = {
            ...uploadingSession,
            status: 'uploaded',
            // `ownedMedia`'s original defaults to video/mp4 — override to match
            // `uploadingSession.expectedMimeType` (video/quicktime), which the
            // schema's superRefine cross-checks against the original receipt.
            original: {
                ...ownedMedia('original', 'session-media/artist-1/session-1/original/' + 'a'.repeat(64) + '.mov'),
                mimeType: 'video/quicktime',
            },
            proxyJob: queuedProxyJob,
        };
        it('accepts a real dispatched session exactly as dispatchSessionProxyJob.ts writes it', () => {
            const result = VideoSessionSchema.safeParse(dispatchedSession);
            expect(result.success).toBe(true);
        });
        it('accepts a blocked claim (worker not yet provisioned)', () => {
            expect(ProxyJobClaimSchema.safeParse({
                ...queuedProxyJob,
                status: 'blocked',
                blockedReason: 'proxy-worker-not-configured',
            }).success).toBe(true);
        });
        it('rejects a proxy job claim bound to a different original than the session', () => {
            const result = VideoSessionSchema.safeParse({
                ...dispatchedSession,
                proxyJob: { ...queuedProxyJob, originalSha256: 'b'.repeat(64) },
            });
            expect(result.success).toBe(false);
        });
    });
});
