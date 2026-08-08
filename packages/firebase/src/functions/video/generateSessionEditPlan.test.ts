import { describe, expect, it, vi } from 'vitest';
import type { Models } from '@google/genai';
import { createDefaultEditPlanGenerator, createGenerateSessionEditPlanHandler } from './generateSessionEditPlan';

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
        proxy: {
            bucket: 'indii-test.firebasestorage.app',
            path: 'session-media/user-1/session-1/proxy/video.mp4',
            mimeType: 'video/mp4',
        },
        inspection: {
            proxyDurationUs: 10_000_000,
            originalDurationUs: 10_000_000,
        },
        timeMap: {
            version: 'presentation-time-map.v1',
            segments: [{
                proxyStartUs: 0,
                proxyEndUs: 10_000_000,
                originalStartUs: 0,
                originalEndUs: 10_000_000,
            }],
        },
    },
};

const generatedPlan = {
    schemaVersion: 'session-edit-plan.v1' as const,
    planId: 'plan-generated-1',
    sessionId: 'session-1',
    ownerUid: 'user-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    sourceGeneration: '123456789',
    segments: [{
        segmentId: 'seg-1',
        classification: 'spoken' as const,
        proxyStartUs: 0,
        proxyEndUs: 5_000_000,
        originalStartUs: 0,
        originalEndUs: 5_000_000,
        transcriptText: 'Opening statement',
        words: [],
        confidence: 0.88,
        takeIndex: 1,
        isBestTake: true,
        qualityFlags: [],
    }],
    modelProvenance: { provider: 'vertex_ai', modelId: 'test-model' },
    createdAt: '2026-08-08T20:00:00.000Z',
    receiptId: 'receipt-plan-generated-1',
};

describe('generateSessionEditPlan Handler', () => {
    it('generates a new SessionEditPlan and persists it', async () => {
        const db = createFakeFirestore(mockSession);
        const generator = { generate: vi.fn().mockResolvedValue(generatedPlan) };
        const handler = createGenerateSessionEditPlanHandler(db, generator);

        const result = await handler({
            sessionId: 'session-1',
        }, 'user-1');

        expect(result.reused).toBe(false);
        expect(result.plan.sessionId).toBe('session-1');
        expect(result.plan.ownerUid).toBe('user-1');
        expect(result.plan.segments.length).toBeGreaterThan(0);
        expect(result.plan.segments[0]?.classification).toBe('spoken');
        expect(generator.generate).toHaveBeenCalledWith(expect.objectContaining({
            proxy: {
                bucket: 'indii-test.firebasestorage.app',
                path: 'session-media/user-1/session-1/proxy/video.mp4',
                mimeType: 'video/mp4',
            },
            timeMap: mockSession.proxyManifest.timeMap,
        }));
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

describe('default session edit-plan generator', () => {
    const input = {
        sessionId: 'session-1',
        ownerUid: 'user-1',
        organizationId: 'org-1',
        projectId: 'proj-1',
        sourceGeneration: '123456789',
        durationUs: 10_000_000,
        syncAlignmentId: 'alignment-1',
        proxy: {
            bucket: 'indii-test.firebasestorage.app',
            path: 'session-media/user-1/session-1/proxy/video.mp4',
            mimeType: 'video/mp4',
        },
        timeMap: {
            version: 'presentation-time-map.v1' as const,
            segments: [{
                proxyStartUs: 0,
                proxyEndUs: 10_000_000,
                originalStartUs: 0,
                originalEndUs: 20_000_000,
            }],
        },
    };

    it('builds a validated plan from the private proxy and real model metadata', async () => {
        const generateContent = vi.fn().mockResolvedValue({
            text: JSON.stringify({
                segments: [{
                    classification: 'performance',
                    proxyStartUs: 1_000_000,
                    proxyEndUs: 3_000_000,
                    transcriptText: '[Visual] Artist performs the chorus.',
                    confidence: 0.82,
                    takeIndex: 2,
                    isBestTake: true,
                    qualityFlags: ['reverb'],
                }],
            }),
            modelVersion: 'gemini-real-version',
            usageMetadata: { promptTokenCount: 321, candidatesTokenCount: 123 },
        });
        const generator = createDefaultEditPlanGenerator({ generateContent } as unknown as Pick<Models, 'generateContent'>);

        const plan = await generator.generate(input);

        expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
            contents: [expect.objectContaining({
                parts: expect.arrayContaining([
                    expect.objectContaining({
                        fileData: {
                            mimeType: 'video/mp4',
                            fileUri: 'gs://indii-test.firebasestorage.app/session-media/user-1/session-1/proxy/video.mp4',
                        },
                    }),
                ]),
            })],
        }));
        expect(plan.segments[0]).toEqual(expect.objectContaining({
            classification: 'performance',
            proxyStartUs: 1_000_000,
            proxyEndUs: 3_000_000,
            originalStartUs: 2_000_000,
            originalEndUs: 6_000_000,
            confidence: 0.82,
        }));
        expect(plan.modelProvenance).toEqual({
            provider: 'vertex_ai',
            modelId: 'gemini-real-version',
            promptTokens: 321,
            completionTokens: 123,
        });
    });

    it('fails closed instead of persisting a fabricated plan when model timing is invalid', async () => {
        const generateContent = vi.fn().mockResolvedValue({
            text: JSON.stringify({
                segments: [{
                    classification: 'spoken',
                    proxyStartUs: 0,
                    proxyEndUs: 11_000_000,
                    transcriptText: 'Out of bounds',
                    confidence: 0.9,
                    isBestTake: true,
                    qualityFlags: [],
                }],
            }),
        });
        const generator = createDefaultEditPlanGenerator({ generateContent } as unknown as Pick<Models, 'generateContent'>);

        await expect(generator.generate(input)).rejects.toThrow('invalid segment timing');
    });
});
