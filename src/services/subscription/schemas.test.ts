import { describe, it, expect } from 'vitest';
import {
    SubscriptionSchema,
    UsageStatsSchema,
    UsageRecordSchema
} from './schemas';
import { SubscriptionTier } from './SubscriptionTier';

describe('Subscription Schemas', () => {
    describe('SubscriptionSchema', () => {
        it('should validate valid subscription', () => {
            const data = {
                id: 'sub_123',
                userId: 'user_123',
                tier: SubscriptionTier.FREE,
                status: 'active',
                currentPeriodStart: 1000,
                currentPeriodEnd: 2000,
                cancelAtPeriodEnd: false,
                createdAt: 1000,
                updatedAt: 1000
            };
            const result = SubscriptionSchema.parse(data);
            expect(result.status).toBe('active');
        });

        it('should fail on invalid enum', () => {
            const data = {
                id: 'sub_123',
                userId: 'user_123',
                tier: SubscriptionTier.FREE,
                status: 'invalid_status', // Error
                currentPeriodStart: 1000,
                currentPeriodEnd: 2000,
                cancelAtPeriodEnd: false,
                createdAt: 1000,
                updatedAt: 1000
            };
            expect(() => SubscriptionSchema.parse(data)).toThrow();
        });
    });

    describe('UsageStatsSchema', () => {
        it('should validate usage stats', () => {
            const data = {
                tier: SubscriptionTier.PRO_MONTHLY,
                resetDate: 1000,
                imagesGenerated: 10,
                imagesRemaining: 90,
                imagesPerMonth: 100,
                videoDurationSeconds: 60,
                videoDurationMinutes: 1,
                videoRemainingMinutes: 59,
                videoTotalMinutes: 60,
                aiChatTokensUsed: 100,
                aiChatTokensRemaining: 900,
                aiChatTokensPerMonth: 1000,
                storageUsedGB: 1,
                storageRemainingGB: 9,
                storageTotalGB: 10,
                projectsCreated: 2,
                projectsRemaining: 8,
                maxProjects: 10,
                teamMembersUsed: 1,
                teamMembersRemaining: 4,
                maxTeamMembers: 5
            };
            const result = UsageStatsSchema.parse(data);
            expect(result.tier).toBe(SubscriptionTier.PRO_MONTHLY);
        });
    });

    describe('UsageRecordSchema', () => {
        it('should validate usage record', () => {
            const data = {
                id: 'rec_1',
                userId: 'u1',
                subscriptionId: 's1',
                type: 'image',
                amount: 1,
                timestamp: 123
            };
            expect(UsageRecordSchema.parse(data).type).toBe('image');
        });
    });
});
