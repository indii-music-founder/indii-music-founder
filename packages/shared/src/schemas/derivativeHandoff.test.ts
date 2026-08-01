import { describe, expect, it } from 'vitest';
import { DerivativeAssetReceiptSchema, SocialHandoffDraftSchema } from './derivativeHandoff';

describe('DerivativeHandoff Schema Validation', () => {
    const validDerivative = {
        schemaVersion: 'derivative-asset-receipt.v1',
        derivativeId: 'deriv-1',
        sessionId: 'session-1',
        approvalReceiptId: 'app-1',
        timelineRevisionId: 'rev-10',
        renderJobId: 'render-10',
        ownerUid: 'user-1',
        organizationId: 'org-1',
        projectId: 'proj-1',
        sourceGeneration: '9876543210',
        masterGeneration: '1234567890',
        aspectRatio: '9:16',
        codec: 'h264',
        mimeType: 'video/mp4',
        width: 1080,
        height: 1920,
        durationUs: 15_000_000,
        byteSize: 12_500_000,
        sha256: 'a'.repeat(64),
        storageBucket: 'indii-app.appspot.com',
        storagePath: 'users/user-1/derivatives/deriv-1.mp4',
        generation: '1122334455',
        metageneration: '3',
        verifiedAt: '2026-08-01T12:00:01.000Z',
        renderedAt: '2026-08-01T12:00:00.000Z',
        renderCostUsd: 0.15,
        isTerminalPlayable: true,
    };

    const validDraft = {
        schemaVersion: 'social-handoff-draft.v1',
        draftId: 'draft-1',
        derivativeId: 'deriv-1',
        ownerUid: 'user-1',
        organizationId: 'org-1',
        projectId: 'proj-1',
        targetPlatforms: ['tiktok', 'instagram'],
        captionText: 'Check out this live studio session! #indii #music',
        suggestedHashtags: ['indii', 'music', 'live'],
        isPublished: false,
        createdAt: new Date().toISOString(),
    };

    it('validates a correct DerivativeAssetReceipt payload', () => {
        const result = DerivativeAssetReceiptSchema.safeParse(validDerivative);
        expect(result.success).toBe(true);
    });

    it('rejects verification that predates render completion', () => {
        expect(DerivativeAssetReceiptSchema.safeParse({
            ...validDerivative,
            renderedAt: '2026-08-01T12:00:00.000Z',
            verifiedAt: '2026-08-01T11:59:59.000Z',
        }).success).toBe(false);
    });

    it('rejects render costs that cannot be represented as exact USD micros', () => {
        expect(DerivativeAssetReceiptSchema.safeParse({
            ...validDerivative,
            renderCostUsd: 0.0500001,
        }).success).toBe(false);
    });

    it('validates a correct SocialHandoffDraft payload with isPublished: false', () => {
        const result = SocialHandoffDraftSchema.safeParse(validDraft);
        expect(result.success).toBe(true);
    });
});
