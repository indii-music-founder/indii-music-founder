import { HttpsError } from 'firebase-functions/v2/https';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    readVideoRenderReceipt,
    type VideoRenderReceiptDependencies,
} from './getVideoRenderReceipt';

const JOB_ID = 'render-1';
const OWNER_UID = 'owner-1';
const PROJECT_ID = 'project-1';
const BUCKET = 'indii-music-founder.firebasestorage.app';
const RESULT_URI = `gs://${BUCKET}/private-renders/${OWNER_UID}/${PROJECT_ID}/${JOB_ID}/master-pass/final_output.mp4`;

function job(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: JOB_ID,
        type: 'render_stitch',
        accessPolicy: 'private-project-render.v1',
        userId: OWNER_UID,
        orgId: 'org-1',
        projectId: PROJECT_ID,
        status: 'completed',
        progress: 100,
        resultUri: RESULT_URI,
        resultGeneration: '123456789',
        ...overrides,
    };
}

describe('readVideoRenderReceipt', () => {
    let dependencies: VideoRenderReceiptDependencies;

    beforeEach(() => {
        dependencies = {
            bucketName: BUCKET,
            now: vi.fn(() => 1_800_000_000_000),
            getJob: vi.fn(async () => job()),
            authorizeProject: vi.fn(async () => undefined),
            inspectObject: vi.fn(async () => ({
                generation: '123456789',
                contentType: 'video/mp4',
            })),
            signObject: vi.fn(async () => 'https://storage.googleapis.com/signed-private-render'),
        };
    });

    it.each([
        ['queued', 'queued'],
        ['processing', 'running'],
        ['stitching', 'running'],
        ['failed', 'failed'],
    ] as const)('returns a %s receipt without issuing a URL', async (jobStatus, receiptStatus) => {
        vi.mocked(dependencies.getJob).mockResolvedValue(job({
            status: jobStatus,
            progress: 35,
            error: jobStatus === 'failed' ? 'codec failure' : undefined,
        }));

        const receipt = await readVideoRenderReceipt(OWNER_UID, { jobId: JOB_ID }, dependencies);

        expect(receipt.status).toBe(receiptStatus);
        expect(dependencies.inspectObject).not.toHaveBeenCalled();
        expect(dependencies.signObject).not.toHaveBeenCalled();
    });

    it('authorizes owner or project-member access before inspecting or signing the terminal object', async () => {
        await readVideoRenderReceipt('project-member-1', { jobId: JOB_ID }, dependencies);

        expect(dependencies.authorizeProject).toHaveBeenCalledWith('project-member-1', 'org-1', PROJECT_ID);
        expect(vi.mocked(dependencies.authorizeProject).mock.invocationCallOrder[0])
            .toBeLessThan(vi.mocked(dependencies.inspectObject).mock.invocationCallOrder[0]!);
        expect(vi.mocked(dependencies.inspectObject).mock.invocationCallOrder[0])
            .toBeLessThan(vi.mocked(dependencies.signObject).mock.invocationCallOrder[0]!);
    });

    it('denies a cross-owner or cross-project requester without touching Storage', async () => {
        vi.mocked(dependencies.authorizeProject).mockRejectedValue(
            new HttpsError('permission-denied', 'Project is unavailable.'),
        );

        await expect(readVideoRenderReceipt('attacker', { jobId: JOB_ID }, dependencies))
            .rejects.toMatchObject({ code: 'permission-denied' });
        expect(dependencies.inspectObject).not.toHaveBeenCalled();
        expect(dependencies.signObject).not.toHaveBeenCalled();
    });

    it('rejects caller-selected fields and never accepts a storage path from the request', async () => {
        await expect(readVideoRenderReceipt(OWNER_UID, {
            jobId: JOB_ID,
            storagePath: 'public/attacker.mp4',
        }, dependencies)).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(dependencies.getJob).not.toHaveBeenCalled();
    });

    it.each([
        ['malformed URI', { resultUri: `gs://${BUCKET}/private-renders/${OWNER_UID}/other-project/${JOB_ID}/master-pass/final_output.mp4` }],
        ['malformed generation', { resultGeneration: '../latest' }],
        ['wrong object generation', {}, { generation: '987654321', contentType: 'video/mp4' }],
        ['wrong MIME type', {}, { generation: '123456789', contentType: 'text/html' }],
    ])('rejects %s without issuing a URL', async (
        _label,
        overrides,
        metadata = { generation: '123456789', contentType: 'video/mp4' },
    ) => {
        vi.mocked(dependencies.getJob).mockResolvedValue(job(overrides));
        vi.mocked(dependencies.inspectObject).mockResolvedValue(metadata);

        await expect(readVideoRenderReceipt(OWNER_UID, { jobId: JOB_ID }, dependencies))
            .rejects.toBeInstanceOf(HttpsError);
        expect(dependencies.signObject).not.toHaveBeenCalled();
    });

    it('rejects a missing terminal object and a revoked terminal job', async () => {
        vi.mocked(dependencies.inspectObject).mockRejectedValueOnce(new Error('not found'));
        await expect(readVideoRenderReceipt(OWNER_UID, { jobId: JOB_ID }, dependencies))
            .rejects.toMatchObject({ code: 'failed-precondition' });
        expect(dependencies.signObject).not.toHaveBeenCalled();

        vi.mocked(dependencies.getJob).mockResolvedValueOnce(job({ accessRevokedAt: 'now' }));
        await expect(readVideoRenderReceipt(OWNER_UID, { jobId: JOB_ID }, dependencies))
            .rejects.toMatchObject({ code: 'permission-denied' });
        expect(dependencies.signObject).not.toHaveBeenCalled();
    });

    it('never signs a completed-looking job when a durable cancellation marker exists', async () => {
        vi.mocked(dependencies.getJob).mockResolvedValue(job({
            status: 'completed',
            cancelledAt: '2026-07-30T20:00:00.000Z',
        }));

        await expect(readVideoRenderReceipt(OWNER_UID, { jobId: JOB_ID }, dependencies))
            .resolves.toMatchObject({
                status: 'failed',
                error: 'The private render was cancelled.',
            });
        expect(dependencies.inspectObject).not.toHaveBeenCalled();
        expect(dependencies.signObject).not.toHaveBeenCalled();
    });

    it('issues a generation-bound URL for at most five minutes only after completion', async () => {
        const receipt = await readVideoRenderReceipt(OWNER_UID, { jobId: JOB_ID }, dependencies);

        expect(receipt).toEqual({
            status: 'completed',
            renderId: JOB_ID,
            projectId: PROJECT_ID,
            progress: 100,
            asset: {
                url: 'https://storage.googleapis.com/signed-private-render',
                expiresAt: 1_800_000_300_000,
                generation: '123456789',
                mimeType: 'video/mp4',
            },
        });
        expect(dependencies.inspectObject).toHaveBeenCalledWith(
            `private-renders/${OWNER_UID}/${PROJECT_ID}/${JOB_ID}/master-pass/final_output.mp4`,
            '123456789',
        );
        expect(dependencies.signObject).toHaveBeenCalledWith(
            `private-renders/${OWNER_UID}/${PROJECT_ID}/${JOB_ID}/master-pass/final_output.mp4`,
            '123456789',
            1_800_000_300_000,
        );
    });
});
