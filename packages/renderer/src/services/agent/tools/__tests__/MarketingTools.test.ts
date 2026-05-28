
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketingTools } from '../MarketingTools';
import { AutonomousIntelligence as AI } from '@/services/intelligence/AutonomousIntelligence';
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
        expect(parsed.status).toBe("scheduled");
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

        const result = await MarketingTools.create_campaign_brief({ product: 'Test', goal: 'Win' });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockResponse);
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
});
