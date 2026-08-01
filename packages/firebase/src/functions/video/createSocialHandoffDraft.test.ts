import { describe, expect, it, vi } from 'vitest';
import {
    createCreateSocialHandoffDraftHandler,
    parseVerifiedDerivativeObjectMetadata,
    SocialHandoffDraftDependencies,
} from './createSocialHandoffDraft';

const HASH_64 = 'a'.repeat(64);
const PROJECT_BUCKET = 'indii-test.firebasestorage.app';
const STORAGE_PATH = 'private-renders/user-1/proj-1/render-1/master-pass/final_output.mp4';

const derivative = {
    schemaVersion: 'derivative-asset-receipt.v1',
    derivativeId: 'deriv-1',
    sessionId: 'session-1',
    approvalReceiptId: 'approval-1',
    timelineRevisionId: 'timeline-1',
    renderJobId: 'render-1',
    ownerUid: 'user-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    sourceGeneration: '123456789',
    masterGeneration: '987654321',
    aspectRatio: '9:16',
    codec: 'h264',
    mimeType: 'video/mp4',
    width: 1080,
    height: 1920,
    durationUs: 10_000_000,
    byteSize: 5_000_000,
    sha256: HASH_64,
    storageBucket: PROJECT_BUCKET,
    storagePath: STORAGE_PATH,
    generation: '999888777',
    metageneration: '4',
    verifiedAt: '2026-07-31T18:00:00.000Z',
    renderedAt: '2026-07-31T17:59:00.000Z',
    renderCostUsd: 0.05,
    isTerminalPlayable: true,
} as const;

const session = {
    sessionId: 'session-1',
    ownerUid: 'user-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    status: 'completed',
    terminalReceiptId: 'session-terminal-1',
    original: { generation: '123456789' },
};

const approval = {
    schemaVersion: 'approval-receipt.v1',
    approvalReceiptId: 'approval-1',
    sessionId: 'session-1',
    planId: 'plan-1',
    ownerUid: 'user-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    sourceGeneration: '123456789',
    masterGeneration: '987654321',
    decisions: [{ segmentId: 'segment-1', action: 'keep', acknowledgedLowConfidence: false }],
    approvedAt: '2026-07-31T17:00:00.000Z',
    approverUid: 'user-1',
};

const renderJob = {
    id: 'render-1',
    userId: 'user-1',
    orgId: 'org-1',
    projectId: 'proj-1',
    sessionId: 'session-1',
    approvalReceiptId: 'approval-1',
    timelineRevisionId: 'timeline-1',
    sourceGeneration: '123456789',
    aspectRatio: '9:16',
    type: 'render_stitch',
    accessPolicy: 'private-project-render.v1',
    status: 'completed',
    completedAt: '2026-07-31T17:59:00.000Z',
    resultUri: `gs://${PROJECT_BUCKET}/${STORAGE_PATH}`,
    resultGeneration: '999888777',
    resultMetageneration: '4',
    resultSha256: HASH_64,
    resultByteSize: 5_000_000,
    resultMimeType: 'video/mp4',
    costReservationId: 'reservation-1',
    actualCost: 0.05,
};

const objectMetadata = {
    generation: '999888777',
    metageneration: '4',
    byteSize: 5_000_000,
    mimeType: 'video/mp4',
    sha256: HASH_64,
};

const request = {
    derivativeId: 'deriv-1',
    targetPlatforms: ['tiktok', 'instagram'],
    captionText: 'New track teaser out now!',
    suggestedHashtags: ['#indii', '#newmusic'],
};

function createDependencies(overrides: Partial<SocialHandoffDraftDependencies> = {}) {
    const drafts = new Map<string, unknown>();
    const dependencies: SocialHandoffDraftDependencies = {
        projectBucketName: PROJECT_BUCKET,
        getDerivative: vi.fn().mockResolvedValue(derivative),
        getSession: vi.fn().mockResolvedValue(session),
        getApproval: vi.fn().mockResolvedValue(approval),
        getRenderJob: vi.fn().mockResolvedValue(renderJob),
        inspectObject: vi.fn().mockResolvedValue(objectMetadata),
        persistDraft: vi.fn().mockImplementation(async (draftId, draft) => {
            const existing = drafts.get(draftId);
            if (existing) return { draft: existing, created: false };
            drafts.set(draftId, draft);
            return { draft, created: true };
        }),
        ...overrides,
    };
    return dependencies;
}

describe('createSocialHandoffDraft Handler', () => {
    it('rejects a path-like derivative id before any Firestore lookup', async () => {
        const dependencies = createDependencies();
        const handler = createCreateSocialHandoffDraftHandler(dependencies);

        await expect(handler({ ...request, derivativeId: 'other-user/deriv-1' }, 'user-1'))
            .rejects.toThrow('request is malformed');
        expect(dependencies.getDerivative).not.toHaveBeenCalled();
    });

    it('parses exact immutable GCS object metadata used by the production adapter', () => {
        expect(parseVerifiedDerivativeObjectMetadata({
            generation: '999888777',
            metageneration: '4',
            size: '5000000',
            contentType: 'video/mp4',
            metadata: { sha256: HASH_64 },
        })).toEqual(objectMetadata);
    });

    it.each([
        ['generation', { metageneration: '4', size: '5000000', contentType: 'video/mp4', metadata: { sha256: HASH_64 } }],
        ['metageneration', { generation: '999888777', size: '5000000', contentType: 'video/mp4', metadata: { sha256: HASH_64 } }],
        ['hash', { generation: '999888777', metageneration: '4', size: '5000000', contentType: 'video/mp4', metadata: {} }],
        ['MIME', { generation: '999888777', metageneration: '4', size: '5000000', contentType: 'video/quicktime', metadata: { sha256: HASH_64 } }],
        ['size', { generation: '999888777', metageneration: '4', size: '0', contentType: 'video/mp4', metadata: { sha256: HASH_64 } }],
    ])('rejects production object metadata missing or invalid %s', (_label, metadata) => {
        expect(() => parseVerifiedDerivativeObjectMetadata(metadata)).toThrow(
            'metadata is incomplete or invalid',
        );
    });

    it('creates an unpublished draft only for a preverified derivative fixture', async () => {
        const dependencies = createDependencies();
        const handler = createCreateSocialHandoffDraftHandler(dependencies);

        const result = await handler(request, 'user-1');

        expect(result.reused).toBe(false);
        expect(result.draft).toMatchObject({
            derivativeId: 'deriv-1',
            ownerUid: 'user-1',
            targetPlatforms: ['instagram', 'tiktok'],
            isPublished: false,
        });
        expect(dependencies.inspectObject).toHaveBeenCalledWith(
            PROJECT_BUCKET,
            STORAGE_PATH,
            '999888777',
        );
    });

    it('rejects a missing derivative instead of synthesizing a receipt', async () => {
        const handler = createCreateSocialHandoffDraftHandler(createDependencies({
            getDerivative: vi.fn().mockResolvedValue(undefined),
        }));

        await expect(handler(request, 'user-1')).rejects.toThrow(
            'derivative asset receipt does not exist',
        );
    });

    it.each(['renderJobId', 'generation', 'metageneration', 'sha256', 'mimeType'] as const)(
        'rejects a fabricated receipt missing %s',
        async field => {
            const fabricated = { ...derivative } as Record<string, unknown>;
            delete fabricated[field];
            const handler = createCreateSocialHandoffDraftHandler(createDependencies({
                getDerivative: vi.fn().mockResolvedValue(fabricated),
            }));

            await expect(handler(request, 'user-1')).rejects.toThrow(
                'not a verified terminal receipt',
            );
        },
    );

    it('rejects a receipt that claims a nonterminal derivative', async () => {
        const handler = createCreateSocialHandoffDraftHandler(createDependencies({
            getDerivative: vi.fn().mockResolvedValue({ ...derivative, isTerminalPlayable: false }),
        }));

        await expect(handler(request, 'user-1')).rejects.toThrow(
            'not a verified terminal receipt',
        );
    });

    it('denies a cross-owner derivative before reading render evidence', async () => {
        const dependencies = createDependencies({
            getDerivative: vi.fn().mockResolvedValue({ ...derivative, ownerUid: 'other-user' }),
        });
        const handler = createCreateSocialHandoffDraftHandler(dependencies);

        await expect(handler(request, 'user-1')).rejects.toThrow('Cross-owner');
        expect(dependencies.getSession).not.toHaveBeenCalled();
    });

    it.each([
        ['project', { ...session, projectId: 'other-project' }],
        ['session', { ...session, sessionId: 'other-session' }],
    ])('rejects a derivative with the wrong %s binding', async (_label, invalidSession) => {
        const handler = createCreateSocialHandoffDraftHandler(createDependencies({
            getSession: vi.fn().mockResolvedValue(invalidSession),
        }));

        await expect(handler(request, 'user-1')).rejects.toThrow(
            'not bound to a completed owner-scoped video session',
        );
    });

    it('rejects nonterminal render evidence', async () => {
        const handler = createCreateSocialHandoffDraftHandler(createDependencies({
            getRenderJob: vi.fn().mockResolvedValue({ ...renderJob, status: 'processing' }),
        }));

        await expect(handler(request, 'user-1')).rejects.toThrow(
            'not backed by a completed private render job',
        );
    });

    it.each([
        ['missing', { ...renderJob, actualCost: undefined }],
        ['malformed', { ...renderJob, actualCost: Number.NaN }],
        ['negative', { ...renderJob, actualCost: -0.05 }],
        ['mismatched', { ...renderJob, actualCost: 0.06 }],
        ['imprecise', { ...renderJob, actualCost: 0.0500001 }],
    ])('rejects %s authoritative render cost evidence', async (_label, invalidJob) => {
        const handler = createCreateSocialHandoffDraftHandler(createDependencies({
            getRenderJob: vi.fn().mockResolvedValue(invalidJob),
        }));

        await expect(handler(request, 'user-1')).rejects.toThrow(
            'not backed by a completed private render job',
        );
    });

    it.each([
        ['missing', { ...renderJob, completedAt: undefined }],
        ['malformed ISO', { ...renderJob, completedAt: 'not-a-date' }],
        ['mismatched ISO', { ...renderJob, completedAt: '2026-07-31T17:59:01.000Z' }],
        ['malformed Timestamp', { ...renderJob, completedAt: { seconds: 1, nanoseconds: -1 } }],
    ])('rejects %s authoritative completion evidence', async (_label, invalidJob) => {
        const handler = createCreateSocialHandoffDraftHandler(createDependencies({
            getRenderJob: vi.fn().mockResolvedValue(invalidJob),
        }));

        await expect(handler(request, 'user-1')).rejects.toThrow(
            'not backed by a completed private render job',
        );
    });

    it('accepts a Firestore Timestamp completion matching the receipt exactly', async () => {
        const seconds = Date.parse(derivative.renderedAt) / 1000;
        const handler = createCreateSocialHandoffDraftHandler(createDependencies({
            getRenderJob: vi.fn().mockResolvedValue({
                ...renderJob,
                completedAt: { seconds, nanoseconds: 0 },
            }),
        }));

        await expect(handler(request, 'user-1')).resolves.toMatchObject({ reused: false });
    });

    it.each([
        ['owner', { ...renderJob, userId: 'other-user' }],
        ['project', { ...renderJob, projectId: 'other-project' }],
        ['session', { ...renderJob, sessionId: 'other-session' }],
    ])('rejects completed render evidence with the wrong %s binding', async (_label, invalidJob) => {
        const handler = createCreateSocialHandoffDraftHandler(createDependencies({
            getRenderJob: vi.fn().mockResolvedValue(invalidJob),
        }));

        await expect(handler(request, 'user-1')).rejects.toThrow(
            'not backed by a completed private render job',
        );
    });

    it('rejects an approval that is not bound to the derivative session', async () => {
        const handler = createCreateSocialHandoffDraftHandler(createDependencies({
            getApproval: vi.fn().mockResolvedValue({ ...approval, sessionId: 'other-session' }),
        }));

        await expect(handler(request, 'user-1')).rejects.toThrow(
            'not bound to a valid owner approval receipt',
        );
    });

    it.each([
        ['generation', { ...objectMetadata, generation: '111111111' }],
        ['metageneration', { ...objectMetadata, metageneration: '5' }],
        ['hash', { ...objectMetadata, sha256: 'b'.repeat(64) }],
        ['MIME', { ...objectMetadata, mimeType: 'application/octet-stream' }],
        ['byte size', { ...objectMetadata, byteSize: 10 }],
    ])('rejects wrong immutable object %s metadata', async (_label, metadata) => {
        const handler = createCreateSocialHandoffDraftHandler(createDependencies({
            inspectObject: vi.fn().mockResolvedValue(metadata),
        }));

        await expect(handler(request, 'user-1')).rejects.toThrow(
            'no longer matches its immutable derivative receipt',
        );
    });

    it('rejects unavailable or incomplete exact-generation object metadata', async () => {
        const handler = createCreateSocialHandoffDraftHandler(createDependencies({
            inspectObject: vi.fn().mockRejectedValue(new Error('missing generation')),
        }));

        await expect(handler(request, 'user-1')).rejects.toThrow(
            'verified private render object is unavailable',
        );
    });

    it('replays the same draft idempotently without publishing', async () => {
        const dependencies = createDependencies();
        const handler = createCreateSocialHandoffDraftHandler(dependencies);

        const first = await handler(request, 'user-1');
        const second = await handler(request, 'user-1');

        expect(first.reused).toBe(false);
        expect(second.reused).toBe(true);
        expect(second.draft).toEqual(first.draft);
        expect(second.draft.isPublished).toBe(false);
    });

    it('fails closed if the deterministic draft id already contains different data', async () => {
        const dependencies = createDependencies({
            persistDraft: vi.fn().mockImplementation(async (_draftId, draft) => ({
                draft: { ...draft, ownerUid: 'other-user' },
                created: false,
            })),
        });
        const handler = createCreateSocialHandoffDraftHandler(dependencies);

        await expect(handler(request, 'user-1')).rejects.toThrow(
            'existing handoff draft does not match',
        );
    });
});
