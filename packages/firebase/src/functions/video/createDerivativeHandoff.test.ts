import { describe, expect, it } from 'vitest';
import { createCreateDerivativeHandoffHandler } from './createDerivativeHandoff';

describe('createDerivativeHandoff', () => {
    const mockDb = {
        collection: (collectionName: string) => {
            if (collectionName === 'videoSessions') {
                return {
                    doc: (sessionId: string) => {
                        return {
                            get: async () => {
                                if (sessionId === 'valid-session') {
                                    return {
                                        exists: true,
                                        data: () => ({
                                            sessionId: 'valid-session',
                                            ownerUid: 'owner-123',
                                            organizationId: 'org-123',
                                            projectId: 'project-123',
                                            status: 'completed',
                                            stagingBucket: 'indii-music-founder.firebasestorage.app',
                                            original: { generation: '123456789' },
                                            proxyManifest: {
                                                inspection: { originalDurationUs: 5000000 },
                                            },
                                        }),
                                    };
                                }
                                if (sessionId === 'foreign-session') {
                                    return {
                                        exists: true,
                                        data: () => ({
                                            sessionId: 'foreign-session',
                                            ownerUid: 'other-owner',
                                        }),
                                    };
                                }
                                return { exists: false };
                            },
                            collection: (subName: string) => {
                                if (subName === 'approvals') {
                                    return {
                                        doc: (approvalId: string) => ({
                                            get: async () => ({
                                                exists: approvalId === 'valid-approval',
                                                data: () => ({ approvalReceiptId: 'valid-approval' }),
                                            }),
                                        }),
                                    };
                                }
                                return { doc: () => ({ get: async () => ({ exists: false }) }) };
                            },
                        };
                    },
                };
            }
            return { doc: () => ({ get: async () => ({ exists: false }) }) };
        },
        batch: () => ({
            set: () => {},
            commit: async () => {},
        }),
    } as any;

    const handler = createCreateDerivativeHandoffHandler(mockDb);

    it('creates valid derivative receipt and social handoff draft for valid inputs', async () => {
        const result = await handler({
            sessionId: 'valid-session',
            approvalReceiptId: 'valid-approval',
            timelineRevisionId: 'rev-123',
            aspectRatio: '9:16',
            targetPlatforms: ['instagram', 'tiktok'],
            captionText: 'Check out this new release!',
            suggestedHashtags: ['#music', '#indii'],
        }, 'owner-123');

        expect(result.derivative.schemaVersion).toBe('derivative-asset-receipt.v1');
        expect(result.derivative.aspectRatio).toBe('9:16');
        expect(result.derivative.isTerminalPlayable).toBe(true);
        expect(result.handoffDraft.schemaVersion).toBe('social-handoff-draft.v1');
        expect(result.handoffDraft.targetPlatforms).toEqual(['instagram', 'tiktok']);
        expect(result.handoffDraft.isPublished).toBe(false);
        expect(result.reused).toBe(false);
    });

    it('rejects cross-owner access', async () => {
        await expect(handler({
            sessionId: 'foreign-session',
            approvalReceiptId: 'valid-approval',
            timelineRevisionId: 'rev-123',
            aspectRatio: '9:16',
            targetPlatforms: ['instagram'],
            captionText: 'Test',
            suggestedHashtags: [],
        }, 'owner-123')).rejects.toThrow('Cross-owner video session access is prohibited.');
    });

    it('rejects missing session or approval', async () => {
        await expect(handler({
            sessionId: 'nonexistent',
            approvalReceiptId: 'valid-approval',
            timelineRevisionId: 'rev-123',
            aspectRatio: '9:16',
            targetPlatforms: ['instagram'],
            captionText: 'Test',
            suggestedHashtags: [],
        }, 'owner-123')).rejects.toThrow('The specified video session does not exist.');
    });
});
