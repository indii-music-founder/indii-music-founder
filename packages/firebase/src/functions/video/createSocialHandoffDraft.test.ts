import { describe, expect, it, vi } from 'vitest';
import { createCreateSocialHandoffDraftHandler } from './createSocialHandoffDraft';

const HASH_64 = 'a'.repeat(64);

function createFakeFirestore(derivativeData?: Record<string, any>, draftData?: Record<string, any>) {
    let storedDraft = draftData;

    const draftDoc = {
        get: vi.fn().mockImplementation(async () => ({
            exists: !!storedDraft,
            data: () => storedDraft,
        })),
        set: vi.fn().mockImplementation(async (data: any) => {
            storedDraft = data;
        }),
    };

    const socialDraftsCollection = {
        doc: vi.fn().mockReturnValue(draftDoc),
    };

    const derivativeDoc = {
        get: vi.fn().mockImplementation(async () => ({
            exists: !!derivativeData,
            data: () => derivativeData,
        })),
    };

    const derivativesCollection = {
        doc: vi.fn().mockReturnValue(derivativeDoc),
    };

    return {
        collection: vi.fn().mockImplementation((colName: string) => {
            if (colName === 'derivatives') return derivativesCollection;
            if (colName === 'socialDrafts') return socialDraftsCollection;
            return socialDraftsCollection;
        }),
    } as unknown as FirebaseFirestore.Firestore;
}

const mockDerivative = {
    schemaVersion: 'derivative-asset-receipt.v1',
    derivativeId: 'deriv-1',
    sessionId: 'session-1',
    approvalReceiptId: 'app-receipt-1',
    timelineRevisionId: 'rev-1',
    ownerUid: 'user-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    sourceGeneration: '123456789',
    aspectRatio: '9:16',
    codec: 'h264',
    width: 1080,
    height: 1920,
    durationUs: 10_000_000,
    byteSize: 5_000_000,
    sha256: HASH_64,
    storageBucket: 'indii-test.firebasestorage.app',
    storagePath: 'derivatives/user-1/deriv-1.mp4',
    generation: '999888777',
    renderedAt: '2026-07-31T18:00:00.000Z',
    renderCostUsd: 0.05,
    isTerminalPlayable: true,
};

describe('createSocialHandoffDraft Handler', () => {
    it('creates a social handoff draft for a valid playable derivative asset', async () => {
        const db = createFakeFirestore(mockDerivative);
        const handler = createCreateSocialHandoffDraftHandler(db);

        const result = await handler({
            derivativeId: 'deriv-1',
            targetPlatforms: ['tiktok', 'instagram'],
            captionText: 'New track teaser out now!',
            suggestedHashtags: ['#indii', '#newmusic'],
        }, 'user-1');

        expect(result.reused).toBe(false);
        expect(result.draft.derivativeId).toBe('deriv-1');
        expect(result.draft.ownerUid).toBe('user-1');
        expect(result.draft.isPublished).toBe(false);
        expect(result.draft.targetPlatforms).toEqual(['tiktok', 'instagram']);
    });

    it('denies cross-owner derivative asset access', async () => {
        const db = createFakeFirestore(mockDerivative);
        const handler = createCreateSocialHandoffDraftHandler(db);

        await expect(handler({
            derivativeId: 'deriv-1',
            targetPlatforms: ['tiktok'],
        }, 'other-user')).rejects.toThrow('Cross-owner derivative asset access is prohibited.');
    });

    it('rejects handoff draft for non-playable derivative assets', async () => {
        const nonPlayable = { ...mockDerivative, isTerminalPlayable: false };
        const db = createFakeFirestore(nonPlayable);
        const handler = createCreateSocialHandoffDraftHandler(db);

        await expect(handler({
            derivativeId: 'deriv-1',
            targetPlatforms: ['tiktok'],
        }, 'user-1')).rejects.toThrow('playable terminal derivatives');
    });

    it('reuses existing draft when parameters match', async () => {
        const existingDraft = {
            schemaVersion: 'social-handoff-draft.v1',
            draftId: 'existing-draft-1',
            derivativeId: 'deriv-1',
            ownerUid: 'user-1',
            organizationId: 'org-1',
            projectId: 'proj-1',
            targetPlatforms: ['tiktok', 'instagram'],
            captionText: 'Existing caption',
            suggestedHashtags: [],
            isPublished: false,
            createdAt: '2026-07-31T18:00:00.000Z',
        };

        const db = createFakeFirestore(mockDerivative, existingDraft);
        const handler = createCreateSocialHandoffDraftHandler(db);

        const result = await handler({
            derivativeId: 'deriv-1',
            targetPlatforms: ['tiktok', 'instagram'],
        }, 'user-1');

        expect(result.reused).toBe(true);
        expect(result.draft.draftId).toBe('existing-draft-1');
    });
});
