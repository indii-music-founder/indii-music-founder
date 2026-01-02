
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrandTools } from './BrandTools';
import { MarketingTools } from './MarketingTools';
import { RoadTools } from './RoadTools';
import { AI } from '@/services/ai/AIService';

// Mock the AI service
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        generateStructuredData: vi.fn(),
        parseJSON: vi.fn((str) => JSON.parse(str))
    }
}));

describe('Agent Tools Validation', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('BrandTools', () => {
        it('verify_output handles valid JSON response', async () => {
            vi.mocked(AI.generateStructuredData).mockResolvedValue({
                approved: true,
                critique: "Great job",
                score: 9
            } as any);

            const resultStr = await BrandTools.verify_output({ goal: "Test", content: "Test content" });
            const result = JSON.parse(resultStr);
            expect(result.approved).toBe(true);
            expect(result.score).toBe(9);
        });

        it('verify_output handles invalid JSON response gracefully', async () => {
            vi.mocked(AI.generateStructuredData).mockRejectedValue(new Error("AI Generation Failed"));

            const resultStr = await BrandTools.verify_output({ goal: "Test", content: "Test content" });
            const result = JSON.parse(resultStr);
            expect(result.approved).toBe(false);
            expect(result.critique).toBe("AI Generation Failed");
        });

    });

    describe('MarketingTools', () => {
        it('create_campaign_brief handles valid JSON response', async () => {
            vi.mocked(AI.generateStructuredData).mockResolvedValue({
                campaignName: "Test Campaign",
                targetAudience: "Gen Z",
                budget: "$1000",
                channels: ["TikTok"],
                kpis: ["Views"]
            } as any);

            const resultStr = await MarketingTools.create_campaign_brief({ product: "Song", goal: "Viral" });
            const result = JSON.parse(resultStr);
            expect(result.campaignName).toBe("Test Campaign");
            expect(result.targetAudience).toBe("Gen Z");
        });
    });

    describe('RoadTools', () => {
        it('plan_tour_route handles valid JSON response', async () => {
            vi.mocked(AI.generateStructuredData).mockResolvedValue({
                route: ["NY", "NJ"],
                totalDistance: "100 miles",
                estimatedDuration: "2 hours",
                legs: [{ from: "NY", to: "NJ", distance: "100 miles", driveTime: "2 hours" }]
            } as any);


            const resultStr = await RoadTools.plan_tour_route({ locations: ["NY", "NJ"] });
            const result = JSON.parse(resultStr);
            expect(result.route).toContain("NY");
            expect(result.totalDistance).toBe("100 miles");
        });
    });

});
