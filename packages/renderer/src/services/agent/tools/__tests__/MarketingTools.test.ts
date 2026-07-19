
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketingTools } from '../MarketingTools';
import { MarketingService } from '@/services/marketing/MarketingService';

import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});


vi.mock('@/services/marketing/MarketingService', () => ({
    MarketingService: {
        createCampaign: vi.fn(),
    }
}));

describe('MarketingTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('schedule_content generates real dates', async () => {
        // Start date: 2023-01-01 (Sunday)
        // Frequency: Weekly
        // Should generate 4 posts: Jan 1, Jan 8, Jan 15, Jan 22

        const start = "2023-01-01T00:00:00.000Z";
        const result = await MarketingTools.schedule_content({
            campaign_start: start,
            platforms: ["Twitter"],
            frequency: "weekly"
        });

        expect(result.success).toBe(true);
        const parsed = result.data;
        // ISSUE-835: "scheduled" implied posts would actually go out; this is
        // an in-memory plan only, never persisted or queued for delivery.
        expect(parsed.status).toBe("draft_generated");
        expect(parsed.schedule).toHaveLength(4);

        const firstDate = new Date(parsed.schedule[0].date);
        const secondDate = new Date(parsed.schedule[1].date);

        expect(firstDate.toISOString()).toContain("2023-01-01");

        // Difference should be 7 days (approx 604800000 ms)
        const diff = secondDate.getTime() - firstDate.getTime();
        expect(diff).toBeCloseTo(604800000, -5); // within generous margin
    });

    it('create_campaign_brief calls AI', async () => {
        const mockResponse = {
            campaignName: "Test",
            targetAudience: "All",
            budget: "100",
            channels: [],
            kpis: []
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);
        vi.mocked(MarketingService.createCampaign).mockResolvedValue('campaign-real-id');

        const result = await MarketingTools.create_campaign_brief({ product: 'Test', goal: 'Win' });
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ ...mockResponse, campaignId: 'campaign-real-id', saved: true });
        expect(MarketingService.createCampaign).toHaveBeenCalledWith(expect.objectContaining({
            assetType: 'campaign',
            title: 'Test',
            description: 'Win Target audience: All. KPIs: TBD.',
            budget: 100,
            durationDays: 30,
            startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            posts: [expect.objectContaining({
                id: 'brief-post-1',
                platform: 'Instagram',
                copy: 'Test: Win for All.',
                day: 1,
                status: 'PENDING',
            })],
            status: 'PENDING',
            attachedAssets: [],
        }));
    });

    /**
     * ISSUE-835: create_campaign_brief used to catch-and-log a persistence
     * failure, then ALWAYS report "saved to Marketing Dashboard" regardless
     * of whether the write actually succeeded.
     */
    it('create_campaign_brief reports saved: false and does not claim persistence when Firestore write fails', async () => {
        const mockResponse = {
            campaignName: "Test",
            targetAudience: "All",
            budget: "100",
            channels: [],
            kpis: []
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);
        vi.mocked(MarketingService.createCampaign).mockRejectedValue(new Error('User not authenticated'));

        const result = await MarketingTools.create_campaign_brief({ product: 'Test', goal: 'Win' });

        expect(result.success).toBe(true);
        expect(result.data.saved).toBe(false);
        expect(result.data.campaignId).toBeUndefined();
        expect(result.message).toContain('NOT saved');
        expect(result.message).toContain('User not authenticated');
    });

    /**
     * ISSUE-848: tier_superfans used to catch-and-log both "no user signed
     * in" and a real Firestore read failure into the exact same all-zero
     * success result — indistinguishable from a genuinely empty CRM.
     */
    describe('tier_superfans (ISSUE-848)', () => {
        it('returns AUTH_REQUIRED instead of a fake zero-fan result when no user is signed in', async () => {
            const { auth } = await import('@/services/firebase');
            const originalUser = auth.currentUser;
            (auth as { currentUser: unknown }).currentUser = null;

            try {
                const result = await MarketingTools.tier_superfans({ minSpendForVIP: 50, minSpendForSuperfan: 200 });

                expect(result.success).toBe(false);
                expect(result.metadata?.errorCode).toBe('AUTH_REQUIRED');
            } finally {
                (auth as { currentUser: unknown }).currentUser = originalUser;
            }
        });

        it('returns FAN_PURCHASES_UNAVAILABLE with the real error instead of a fake zero-fan result when the Firestore read fails', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore permission denied'));

            const result = await MarketingTools.tier_superfans({ minSpendForVIP: 50, minSpendForSuperfan: 200 });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('FAN_PURCHASES_UNAVAILABLE');
            expect(result.error).toContain('Firestore permission denied');
        });

        it('reports a real, honestly-empty CRM (source, recordsRead) when no purchase records exist', async () => {
            const result = await MarketingTools.tier_superfans({ minSpendForVIP: 50, minSpendForSuperfan: 200 });

            expect(result.success).toBe(true);
            expect(result.data.totalFans).toBe(0);
            expect(result.data.source).toBe('fanPurchases');
            expect(result.data.recordsRead).toBe(0);
            expect(result.message).toContain('no purchase records found');
        });
    });
});
