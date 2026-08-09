import { describe, it, expect } from 'vitest';
import {
    CampaignStatusSchema,
    ScheduledPostSchema,
    CampaignExecutionRequestSchema,
    CampaignExecutionResponseSchema,
} from './schemas';

describe('Marketing Schemas', () => {
    describe('CampaignStatusSchema', () => {
        it('should accept valid statuses', () => {
            expect(CampaignStatusSchema.parse('PENDING')).toBe('PENDING');
            expect(CampaignStatusSchema.parse('FAILED')).toBe('FAILED');
        });
    });

    describe('ScheduledPostSchema', () => {
        it('should validate scheduledTime as Date or string', () => {
            const mockImageAsset = { assetType: 'image' as const, title: 'Test', imageUrl: 'http://test.com', caption: 'Test' };
            const data1 = {
                id: '123',
                platform: 'Twitter' as const,
                copy: 'Test',
                imageAsset: mockImageAsset,
                day: 1,
                status: 'PENDING' as const,
                scheduledTime: new Date()
            };
            expect(ScheduledPostSchema.parse(data1).scheduledTime).toBeInstanceOf(Date);

            const data2 = {
                id: '123',
                platform: 'Twitter' as const,
                copy: 'Test',
                imageAsset: mockImageAsset,
                day: 1,
                status: 'PENDING' as const,
                scheduledTime: '2023-01-01'
            };
            expect(ScheduledPostSchema.parse(data2).scheduledTime).toBe('2023-01-01');
        });
    });

    describe('CampaignExecutionRequestSchema', () => {
        it('accepts bounded Firestore document IDs without trusting client post content', () => {
            const uuid = '123e4567-e89b-12d3-a456-426614174000';
            const simpleId = 'firestore-id-123';

            const data1 = { campaignId: uuid };
            const data2 = { campaignId: simpleId };

            expect(CampaignExecutionRequestSchema.parse(data1).campaignId).toBe(uuid);
            expect(CampaignExecutionRequestSchema.parse(data2).campaignId).toBe(simpleId);
        });

        it('should default dryRun to false', () => {
            const data = { campaignId: '123' };
            expect(CampaignExecutionRequestSchema.parse(data).dryRun).toBe(false);
        });

        it('should allow dryRun to be true', () => {
            const data = { campaignId: '123', dryRun: true };
            expect(CampaignExecutionRequestSchema.parse(data).dryRun).toBe(true);
        });

        it('rejects client-supplied posts and invalid Firestore paths', () => {
            expect(() => CampaignExecutionRequestSchema.parse({ campaignId: '123', posts: [] })).toThrow();
            expect(() => CampaignExecutionRequestSchema.parse({ campaignId: 'campaigns/other-user' })).toThrow();
            expect(() => CampaignExecutionRequestSchema.parse({ campaignId: '' })).toThrow();
        });
    });

    describe('CampaignExecutionResponseSchema', () => {
        it('requires the server-owned campaign status and persisted queued posts', () => {
            const post = {
                id: 'post-1',
                platform: 'Twitter' as const,
                copy: 'Queued copy',
                imageAsset: { assetType: 'image' as const, title: 'Cover', imageUrl: 'https://example.com/cover.jpg', caption: '' },
                day: 1,
                status: 'EXECUTING' as const,
                postId: 'queue-1',
                scheduledTime: '2026-08-10T12:00:00.000Z',
            };

            expect(CampaignExecutionResponseSchema.parse({
                success: true,
                posts: [post],
                status: 'EXECUTING',
                message: 'Campaign queue confirmed.',
            }).posts[0].postId).toBe('queue-1');

            expect(() => CampaignExecutionResponseSchema.parse({
                success: true,
                posts: [post],
                message: 'Missing server status',
            })).toThrow();
        });
    });
});
