import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCheckAndReserve = vi.fn();
const mockRequestApproval = vi.fn();

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'user_founder_test' }
    },
    db: {},
    functions: {}
}));

vi.mock('@/services/billing/CostControlService', () => ({
    CostControlService: {
        checkAndReserve: (...args: any[]) => mockCheckAndReserve(...args)
    }
}));

vi.mock('@/services/security/ExecApprovalService', () => ({
    execApprovalService: {
        requestApproval: (...args: any[]) => mockRequestApproval(...args)
    }
}));

import { EditorTools } from '../EditorTools';

describe('EditorTools (ISSUE-1416 / MIG-011)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckAndReserve.mockResolvedValue({
            allowed: true,
            operationId: 'op_cost_mock_123',
            remainingBudget: 50.0
        });
        mockRequestApproval.mockResolvedValue({
            approved: true,
            reason: 'User approved'
        });
    });

    describe('video_list_renderable_assets', () => {
        it('lists assets filtered by aspect ratio', async () => {
            const result = await EditorTools.video_list_renderable_assets({ aspectRatio: '16:9' });
            expect(result.success).toBe(true);
            expect(result.data.assets.length).toBeGreaterThan(0);
            result.data.assets.forEach((a: any) => {
                expect(a.aspectRatio).toBe('16:9');
            });
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
                transitionDurationSeconds: 1.0
            });

            expect(result.success).toBe(true);
            const plan = result.data.plan;
            expect(plan.slots).toHaveLength(3);
            expect(plan.bpm).toBe(120);
            expect(plan.beatSnapped).toBe(true);
            expect(plan.aspectRatio).toBe('16:9');
            expect(plan.totalDurationSeconds).toBe(30);

            // Slot 0 drop
            expect(plan.slots[0].timelineDropSeconds).toBe(10);
            // Slot 1 drop
            expect(plan.slots[1].timelineDropSeconds).toBe(20);
        });
    });

    describe('video_render_stitch & video_render_chain gates', () => {
        it('fails closed when server cost reservation is denied', async () => {
            mockCheckAndReserve.mockResolvedValueOnce({
                allowed: false,
                reason: 'Daily video generation budget exceeded'
            });

            const result = await EditorTools.video_render_stitch({
                assetIds: ['asset_1', 'asset_2']
            });

            expect(result.success).toBe(false);
            expect(result.metadata.errorCode).toBe('RESOURCE_EXHAUSTED');
            expect(result.error).toContain('Daily video generation budget exceeded');
            expect(mockRequestApproval).not.toHaveBeenCalled();
        });

        it('fails closed when user execution approval is denied', async () => {
            mockRequestApproval.mockResolvedValueOnce({
                approved: false,
                reason: 'User declined stitch render prompt'
            });

            const result = await EditorTools.video_render_stitch({
                assetIds: ['asset_1', 'asset_2']
            });

            expect(result.success).toBe(false);
            expect(result.metadata.errorCode).toBe('APPROVAL_DENIED');
            expect(result.error).toContain('User declined stitch render prompt');
        });

        it('submits a stitch render job when cost and approval are granted via video_render_chain', async () => {
            const result = await EditorTools.video_render_chain({
                assetIds: ['asset_1', 'asset_2', 'asset_3'],
                aspectRatio: '16:9'
            });

            expect(result.success).toBe(true);
            expect(result.data.status).toBe('queued');
            expect(result.data.renderId).toBeDefined();
            expect(result.data.operationId).toBe('op_cost_mock_123');
            expect(mockCheckAndReserve).toHaveBeenCalledWith(expect.objectContaining({
                operationType: 'video',
                userId: 'user_founder_test'
            }));
            expect(mockRequestApproval).toHaveBeenCalledWith(expect.objectContaining({
                category: 'agent',
                requestedScope: 'once'
            }));
        });
    });

    describe('video_get_render_status', () => {
        it('returns honest rendering status without phantom URLs', async () => {
            const result = await EditorTools.video_get_render_status({ renderId: 'render_123' });
            expect(result.success).toBe(true);
            expect(result.data.status).toBe('rendering');
            expect(result.data.progress).toBe(0.65);
            expect(result.data.outputUrl).toBeNull();
            expect(result.data.stage).toContain('xfade');
        });
    });
});
