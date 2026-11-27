import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCheckAndReserve = vi.fn();
const mockRequestApproval = vi.fn();
const mockQueueComposition = vi.fn();
const mockGetRenderReceipt = vi.fn();
const mockGetDocs = vi.fn();

const mockHistory = [
    {
        id: 'asset_1',
        type: 'video',
        url: 'https://storage.googleapis.com/bucket/asset_1.mp4',
        resultUri: 'gs://bucket/users/user_founder_test/asset_1.mp4',
        prompt: 'Opening Verse Tracking Shot',
        durationSeconds: 8,
        aspectRatio: '16:9',
        timestamp: 1700000000000,
    },
    {
        id: 'asset_2',
        type: 'video',
        url: 'https://storage.googleapis.com/bucket/asset_2.mp4',
        resultUri: 'gs://bucket/users/user_founder_test/asset_2.mp4',
        prompt: 'Chorus Drop Performance',
        durationSeconds: 8,
        aspectRatio: '16:9',
        timestamp: 1700000005000,
    },
    {
        id: 'asset_3',
        type: 'video',
        url: 'https://storage.googleapis.com/bucket/asset_3.mp4',
        resultUri: 'gs://bucket/users/user_founder_test/asset_3.mp4',
        prompt: 'Outro Wide Crane Shot',
        durationSeconds: 8,
        aspectRatio: '16:9',
        timestamp: 1700000010000,
    },
    {
        id: 'asset_unknown_dur',
        type: 'video',
        url: 'https://storage.googleapis.com/bucket/unknown.mp4',
        prompt: 'Unprobed Clip',
        aspectRatio: '9:16',
        timestamp: 1700000015000,
    },
];

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'user_founder_test' },
    },
    db: {},
    functions: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            generatedHistory: mockHistory,
            currentProjectId: 'proj_test_01',
            currentOrganizationId: 'org_test_01',
        }),
    },
}));

vi.mock('@/services/billing/CostControlService', () => ({
    CostControlService: {
        checkAndReserve: (...args: unknown[]) => mockCheckAndReserve(...args),
    },
}));

vi.mock('@/services/security/ExecApprovalService', () => ({
    execApprovalService: {
        requestApproval: (...args: unknown[]) => mockRequestApproval(...args),
    },
}));

vi.mock('@/services/video/RenderService', () => ({
    renderService: {
        queueComposition: (...args: unknown[]) => mockQueueComposition(...args),
        getRenderReceipt: (...args: unknown[]) => mockGetRenderReceipt(...args),
    },
}));

import { EditorTools, __resetEditorToolsCacheForTests } from '../EditorTools';

describe('EditorTools (ISSUE-1416 / MIG-011)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetEditorToolsCacheForTests();
        mockGetDocs.mockResolvedValue({ forEach: () => {} });
        mockCheckAndReserve.mockResolvedValue({
            allowed: true,
            operationId: 'op_cost_mock_123',
            remainingBudget: 50.0,
        });
        mockRequestApproval.mockResolvedValue({
            approved: true,
            reason: 'User approved',
        });
        mockQueueComposition.mockResolvedValue({
            status: 'queued',
            renderId: 'render_srv_999',
            projectId: 'proj_test_01',
            progress: 0,
        });
        mockGetRenderReceipt.mockResolvedValue({
            status: 'running',
            renderId: 'render_srv_999',
            projectId: 'proj_test_01',
            progress: 45,
            phase: 'Compiling HyperFrames timeline',
        });
    });

    describe('video_list_renderable_assets', () => {
        it('lists real user assets filtered by aspect ratio without fabricated mocks', async () => {
            const result = await EditorTools.video_list_renderable_assets({ aspectRatio: '16:9' });
            expect(result.success).toBe(true);
            expect(result.data.assets).toHaveLength(3);
            result.data.assets.forEach((asset: { aspectRatio: string; id: string }) => {
                expect(asset.aspectRatio).toBe('16:9');
                expect(asset.id).not.toContain('detroit_skyline');
            });
        });

        it('preserves null duration for unprobed clips instead of fabricating duration', async () => {
            const result = await EditorTools.video_list_renderable_assets({ aspectRatio: '9:16' });
            expect(result.success).toBe(true);
            expect(result.data.assets).toHaveLength(1);
            expect(result.data.assets[0].durationSeconds).toBeNull();
        });
    });

    describe('video_plan_sequence & video_plan_chain', () => {
        it('rejects planning with fewer than 2 assets', async () => {
            const result = await EditorTools.video_plan_sequence({ assetIds: ['asset_1'] });
            expect(result.success).toBe(false);
            expect(result.error).toContain('At least 2 asset IDs are required');
        });

        it('plans a beat-snapped 3-clip sequence accurately via video_plan_chain', async () => {
            const result = await EditorTools.video_plan_chain({
                assetIds: ['asset_1', 'asset_2', 'asset_3'],
                bpm: 120,
                beatSnapped: true,
                aspectRatio: '16:9',
                transitionDurationSeconds: 1.0,
            });

            expect(result.success).toBe(true);
            const plan = result.data.plan;
            expect(plan.slots).toHaveLength(3);
            expect(plan.bpm).toBe(120);
            expect(plan.bpmSource).toBe('measured');
            expect(plan.beatSnapped).toBe(true);
            expect(plan.aspectRatio).toBe('16:9');
            expect(plan.validation.isValid).toBe(true);
        });

        it('flags unknown-duration clips in validation errors', async () => {
            const result = await EditorTools.video_plan_sequence({
                assetIds: ['asset_1', 'asset_unknown_dur'],
            });
            expect(result.success).toBe(true);
            expect(result.data.plan.validation.isValid).toBe(false);
            expect(result.data.plan.validation.errors[0]).toContain('unknown duration');
        });
    });

    describe('video_render_stitch & video_render_chain gates', () => {
        it('fails closed before reserving cost when an asset has unknown duration', async () => {
            const result = await EditorTools.video_render_stitch({
                assetIds: ['asset_1', 'asset_unknown_dur'],
            });

            expect(result.success).toBe(false);
            expect(result.metadata.errorCode).toBe('INVALID_SEQUENCE_PLAN');
            expect(mockCheckAndReserve).not.toHaveBeenCalled();
            expect(mockQueueComposition).not.toHaveBeenCalled();
        });

        it('fails closed when server cost reservation is denied', async () => {
            mockCheckAndReserve.mockResolvedValueOnce({
                allowed: false,
                reason: 'Daily video generation budget exceeded',
            });

            const result = await EditorTools.video_render_stitch({
                assetIds: ['asset_1', 'asset_2'],
            });

            expect(result.success).toBe(false);
            expect(result.metadata.errorCode).toBe('RESOURCE_EXHAUSTED');
            expect(result.error).toContain('Daily video generation budget exceeded');
            expect(mockRequestApproval).not.toHaveBeenCalled();
            expect(mockQueueComposition).not.toHaveBeenCalled();
        });

        it('fails closed when user execution approval is denied', async () => {
            mockRequestApproval.mockResolvedValueOnce({
                approved: false,
                reason: 'User declined stitch render prompt',
            });

            const result = await EditorTools.video_render_stitch({
                assetIds: ['asset_1', 'asset_2'],
            });

            expect(result.success).toBe(false);
            expect(result.metadata.errorCode).toBe('APPROVAL_DENIED');
            expect(result.error).toContain('User declined stitch render prompt');
            expect(mockQueueComposition).not.toHaveBeenCalled();
        });

        it('submits a real RenderService stitch job when cost and approval are granted', async () => {
            const result = await EditorTools.video_render_chain({
                assetIds: ['asset_1', 'asset_2', 'asset_3'],
                aspectRatio: '16:9',
            });

            expect(result.success).toBe(true);
            expect(result.data.status).toBe('queued');
            expect(result.data.renderId).toBe('render_srv_999');
            expect(result.data.outputUrl).toBeNull();
            expect(result.data.operationId).toBe('op_cost_mock_123');
            expect(mockQueueComposition).toHaveBeenCalledWith(expect.objectContaining({
                compositionId: 'AgentStitch',
                projectId: 'proj_test_01',
                organizationId: 'org_test_01',
                useCloudQueue: true,
            }));
        });
    });

    describe('video_get_render_status', () => {
        it('polls real RenderService receipts without phantom URLs', async () => {
            const result = await EditorTools.video_get_render_status({ renderId: 'render_srv_999' });
            expect(result.success).toBe(true);
            expect(mockGetRenderReceipt).toHaveBeenCalledWith('render_srv_999');
            expect(result.data.status).toBe('running');
            expect(result.data.progress).toBe(45);
            expect(result.data.outputUrl).toBeNull();
        });
    });
});
