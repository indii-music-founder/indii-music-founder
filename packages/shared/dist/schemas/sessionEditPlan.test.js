import { describe, expect, it } from 'vitest';
import { SessionEditPlanSchema, SessionSegmentSchema } from './sessionEditPlan';
describe('SessionEditPlan Schema Validation', () => {
    const validSegment = {
        segmentId: 'seg-1',
        classification: 'spoken',
        proxyStartUs: 0,
        proxyEndUs: 5_000_000,
        originalStartUs: 1_000_000,
        originalEndUs: 6_000_000,
        transcriptText: 'Hello world and welcome to the show.',
        words: [
            { word: 'Hello', startUs: 0, endUs: 500_000, confidence: 0.98 },
            { word: 'world', startUs: 500_000, endUs: 1_000_000, confidence: 0.99 },
        ],
        confidence: 0.95,
        takeIndex: 1,
        isBestTake: true,
        qualityFlags: ['noise'],
    };
    const validPlan = {
        schemaVersion: 'session-edit-plan.v1',
        planId: 'plan-123',
        sessionId: 'session-456',
        ownerUid: 'uid-789',
        organizationId: 'org-1',
        projectId: 'proj-1',
        sourceGeneration: '1234567890',
        segments: [validSegment],
        modelProvenance: {
            provider: 'vertex_ai',
            modelId: 'gemini-3-pro-preview',
            promptTokens: 150,
            completionTokens: 300,
        },
        createdAt: new Date().toISOString(),
        receiptId: 'receipt-999',
    };
    it('validates a correct SessionEditPlan payload', () => {
        const result = SessionEditPlanSchema.safeParse(validPlan);
        expect(result.success).toBe(true);
    });
    it('rejects inverted proxy segment bounds (proxyEndUs <= proxyStartUs)', () => {
        const invalidSegment = { ...validSegment, proxyStartUs: 5_000_000, proxyEndUs: 2_000_000 };
        const result = SessionSegmentSchema.safeParse(invalidSegment);
        expect(result.success).toBe(false);
    });
    it('rejects overlapping segments in a plan', () => {
        const seg1 = { ...validSegment, segmentId: 'seg-1', proxyStartUs: 0, proxyEndUs: 5_000_000 };
        const seg2 = { ...validSegment, segmentId: 'seg-2', proxyStartUs: 4_000_000, proxyEndUs: 8_000_000 };
        const overlappingPlan = { ...validPlan, segments: [seg1, seg2] };
        const result = SessionEditPlanSchema.safeParse(overlappingPlan);
        expect(result.success).toBe(false);
    });
});
