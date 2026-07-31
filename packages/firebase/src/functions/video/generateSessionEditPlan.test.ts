import { describe, expect, it, vi } from 'vitest';
import { createGenerateSessionEditPlanHandler } from './generateSessionEditPlan';

const HASH_64 = 'a'.repeat(64);

function createFakeFirestore(sessionData?: Record<string, any>, planData?: Record<string, any>) {
    let storedPlan = planData;

    const planDoc = {
        get: vi.fn().mockImplementation(async () => ({
            exists: !!storedPlan,
            data: () => storedPlan,
        })),
        set: vi.fn().mockImplementation(async (data: any) => {
            storedPlan = data;
        }),
    };

    const editPlansCollection = {
        doc: vi.fn().mockReturnValue(planDoc),
        orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
                get: vi.fn().mockImplementation(async () => ({
                    docs: storedPlan ? [{ data: () => storedPlan }] : [],
                })),
            }),
        }),
    };

    const alignmentsCollection = {
        orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
                get: vi.fn().mockImplementation(async () => ({
                    docs: [],
                })),
            }),
        }),
    };

    const sessionDoc = {
        get: vi.fn().mockImplementation(async () => ({
            exists: !!sessionData,
            data: () => sessionData,
        })),
        collection: vi.fn().mockImplementation((colName: string) => {
            if (colName === 'editPlans') return editPlansCollection;
            if (colName === 'alignments') return alignmentsCollection;
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
    proxyManifest: {
        inspection: {
            proxyDurationUs: 10_000_000,
            originalDurationUs: 10_000_000,
        },
    },
};

describe('generateSessionEditPlan Handler', () => {
    it('generates a new SessionEditPlan and persists it', async () => {
        const db = createFakeFirestore(mockSession);
        const handler = createGenerateSessionEditPlanHandler(db);

        const result = await handler({
            sessionId: 'session-1',
        }, 'user-1');

        expect(result.reused).toBe(false);
        expect(result.plan.sessionId).toBe('session-1');
        expect(result.plan.ownerUid).toBe('user-1');
        expect(result.plan.segments.length).toBeGreaterThan(0);
        expect(result.plan.segments[0]?.classification).toBe('spoken');
    });

    it('denies cross-owner session access', async () => {
        const db = createFakeFirestore(mockSession);
        const handler = createGenerateSessionEditPlanHandler(db);

        await expect(handler({
            sessionId: 'session-1',
        }, 'other-user')).rejects.toThrow('Cross-owner video session access is prohibited.');
    });

    it('rejects plan generation for incomplete video sessions', async () => {
        const incompleteSession = { ...mockSession, status: 'uploading' };
        const db = createFakeFirestore(incompleteSession);
        const handler = createGenerateSessionEditPlanHandler(db);

        await expect(handler({
            sessionId: 'session-1',
        }, 'user-1')).rejects.toThrow('completed with a valid proxy manifest');
    });

    it('reuses existing edit plan when available', async () => {
        const existingPlan = {
            schemaVersion: 'session-edit-plan.v1',
            planId: 'plan-existing-1',
            sessionId: 'session-1',
            ownerUid: 'user-1',
            organizationId: 'org-1',
            projectId: 'proj-1',
            sourceGeneration: '123456789',
            segments: [
                {
                    segmentId: 'seg-1',
                    classification: 'performance',
                    proxyStartUs: 0,
                    proxyEndUs: 5_000_000,
                    originalStartUs: 0,
                    originalEndUs: 5_000_000,
                    transcriptText: 'Performance text',
                    words: [],
                    confidence: 0.9,
                    takeIndex: 1,
                    isBestTake: true,
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

        const db = createFakeFirestore(mockSession, existingPlan);
        const handler = createGenerateSessionEditPlanHandler(db);

        const result = await handler({
            sessionId: 'session-1',
        }, 'user-1');

        expect(result.reused).toBe(true);
        expect(result.plan.planId).toBe('plan-existing-1');
    });
});
