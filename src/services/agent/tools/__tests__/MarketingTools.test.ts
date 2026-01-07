
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketingTools } from '../MarketingTools';
import { AI } from '../services/ai/AIService';
import { MarketingService } from '../services/marketing/MarketingService';

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateStructuredData: vi.fn(),
    }
}));

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

        const parsed = JSON.parse(result);
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
        (AI.generateStructuredData as any).mockResolvedValue(mockResponse);

        const result = await MarketingTools.create_campaign_brief({ product: 'Test', goal: 'Win' });
        expect(JSON.parse(result)).toEqual(mockResponse);
        expect(MarketingService.createCampaign).toHaveBeenCalled();
    });
});
