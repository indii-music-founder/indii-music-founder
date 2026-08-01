import { describe, expect, it, vi } from 'vitest';
import { createApproveSessionEditPlanHandler } from './approveSessionEditPlan';

const HASH_64 = 'a'.repeat(64);

function createFakeFirestore(sessionData?: Record<string, any>, planData?: Record<string, any>, approvalData?: Record<string, any>) {
    let storedApproval = approvalData;

    const approvalDoc = {
        get: vi.fn().mockImplementation(async () => ({
            exists: !!storedApproval,
            data: () => storedApproval,
        })),
        set: vi.fn().mockImplementation(async (data: any) => {
            storedApproval = data;
        }),
    };

    const approvalsCollection = {
        doc: vi.fn().mockReturnValue(approvalDoc),
    };

    const planDoc = {
        get: vi.fn().mockImplementation(async () => ({
            exists: !!planData,
            data: () => planData,
        })),
    };

    const editPlansCollection = {
        doc: vi.fn().mockReturnValue(planDoc),
    };

    const sessionDoc = {
        get: vi.fn().mockImplementation(async () => ({
            exists: !!sessionData,
            data: () => sessionData,
        })),
        collection: vi.fn().mockImplementation((colName: string) => {
            if (colName === 'editPlans') return editPlansCollection;
            if (colName === 'approvals') return approvalsCollection;
            return editPlansCollection;
        }),
    };

    const videoSessionsCollection = {
        doc: vi.fn().mockReturnValue(sessionDoc),
    };

    return {
        collection: vi.fn().mockReturnValue(videoSessionsCollection),
    } as unknown as FirebaseFirestore.Firestore;
}

const mockSession = {
    sessionId: 'session-1',
    ownerUid: 'user-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    status: 'completed',
    original: {
        bucket: 'indii-test.firebasestorage.app',
        path: 'session-media/user-1/session-1/original/video.mp4',
        generation: '123456789',
        sha256: HASH_64,
    },
};

const mockPlan = {
    schemaVersion: 'session-edit-plan.v1',
    planId: 'plan-1',
    sessionId: 'session-1',
    ownerUid: 'user-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    sourceGeneration: '123456789',
    segments: [
        {
            segmentId: 'seg-1',
            classification: 'spoken',
            proxyStartUs: 0,
            proxyEndUs: 5_000_000,
            originalStartUs: 0,
            originalEndUs: 5_000_000,
            transcriptText: 'Hello world',
            words: [],
            confidence: 0.95,
            takeIndex: 1,
            isBestTake: true,
            qualityFlags: [],
        },
        {
            segmentId: 'seg-low-conf',
            classification: 'performance',
            proxyStartUs: 5_000_000,
            proxyEndUs: 10_000_000,
            originalStartUs: 5_000_000,
            originalEndUs: 10_000_000,
            transcriptText: 'Low confidence music',
            words: [],
            confidence: 0.50, // Low confidence
            takeIndex: 1,
            isBestTake: false,
            qualityFlags: [],
        },
    ],
    modelProvenance: {
        provider: 'vertex_ai',
        modelId: 'gemini-3-pro-preview',
    },
    createdAt: '2026-07-31T18:00:00.000Z',
    receiptId: 'receipt-plan-1',
};

describe('approveSessionEditPlan Handler', () => {
    it('creates an approval receipt for high confidence segments', async () => {
        const db = createFakeFirestore(mockSession, mockPlan);
        const handler = createApproveSessionEditPlanHandler(db);

        const result = await handler({
            sessionId: 'session-1',
            planId: 'plan-1',
            decisions: [
                { segmentId: 'seg-1', action: 'keep', acknowledgedLowConfidence: false },
            ],
        }, 'user-1');

        expect(result.reused).toBe(false);
        expect(result.receipt.planId).toBe('plan-1');
        expect(result.receipt.approverUid).toBe('user-1');
        expect(result.receipt.decisions.length).toBe(1);
    });

    it('rejects approval of low confidence segment without explicit acknowledgment', async () => {
        const db = createFakeFirestore(mockSession, mockPlan);
        const handler = createApproveSessionEditPlanHandler(db);

        await expect(handler({
            sessionId: 'session-1',
            planId: 'plan-1',
            decisions: [
                { segmentId: 'seg-low-conf', action: 'keep', acknowledgedLowConfidence: false },
            ],
        }, 'user-1')).rejects.toThrow('requires explicit user acknowledgement');
    });

    it('approves low confidence segment when acknowledgedLowConfidence is true', async () => {
        const db = createFakeFirestore(mockSession, mockPlan);
        const handler = createApproveSessionEditPlanHandler(db);

        const result = await handler({
            sessionId: 'session-1',
            planId: 'plan-1',
            decisions: [
                { segmentId: 'seg-low-conf', action: 'keep', acknowledgedLowConfidence: true },
            ],
        }, 'user-1');

        expect(result.reused).toBe(false);
        expect(result.receipt.decisions[0]?.acknowledgedLowConfidence).toBe(true);
    });

    it('denies cross-owner approval', async () => {
        const db = createFakeFirestore(mockSession, mockPlan);
        const handler = createApproveSessionEditPlanHandler(db);

        await expect(handler({
            sessionId: 'session-1',
            planId: 'plan-1',
            decisions: [
                { segmentId: 'seg-1', action: 'keep', acknowledgedLowConfidence: false },
            ],
        }, 'other-user')).rejects.toThrow('Cross-owner video session access is prohibited.');
    });
});
