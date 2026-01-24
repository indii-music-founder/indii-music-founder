import { describe, it, expect } from 'vitest';
import {
    CampaignStatusSchema,
    ScheduledPostSchema,
    CampaignExecutionRequestSchema
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
             const data1 = {
                id: '123',
                platform: 'Twitter',
                copy: 'Test',
                status: 'PENDING',
                scheduledTime: new Date()
             };
             expect(ScheduledPostSchema.parse(data1).scheduledTime).toBeInstanceOf(Date);

             const data2 = {
                id: '123',
                platform: 'Twitter',
                copy: 'Test',
                status: 'PENDING',
                scheduledTime: '2023-01-01'
             };
             expect(ScheduledPostSchema.parse(data2).scheduledTime).toBe('2023-01-01');
        });
    });

    describe('CampaignExecutionRequestSchema', () => {
        it('should accept UUID or string for campaignId', () => {
             const uuid = '123e4567-e89b-12d3-a456-426614174000';
             const simpleId = 'firestore-id-123';

             const data1 = { campaignId: uuid, posts: [] };
             const data2 = { campaignId: simpleId, posts: [] };

             expect(CampaignExecutionRequestSchema.parse(data1).campaignId).toBe(uuid);
             expect(CampaignExecutionRequestSchema.parse(data2).campaignId).toBe(simpleId);
        });

        it('should default dryRun to false', () => {
             const data = { campaignId: '123', posts: [] };
             expect(CampaignExecutionRequestSchema.parse(data).dryRun).toBe(false);
        });

         it('should allow dryRun to be true', () => {
             const data = { campaignId: '123', posts: [], dryRun: true };
             expect(CampaignExecutionRequestSchema.parse(data).dryRun).toBe(true);
        });
    });
});
