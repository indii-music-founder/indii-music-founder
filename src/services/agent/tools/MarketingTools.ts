
import { AI } from '@/services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// --- Validation Schemas ---

const CreateCampaignBriefSchema = z.object({
    campaignName: z.string(),
    targetAudience: z.string(),
    budget: z.string(),
    channels: z.array(z.string()),
    kpis: z.array(z.string())
});

const AnalyzeAudienceSchema = z.object({
    platform: z.string(),
    demographics: z.object({
        age: z.string(),
        locations: z.array(z.string())
    }),
    interests: z.array(z.string()),
    reach: z.string()
});

const ScheduleContentSchema = z.object({
    status: z.literal("scheduled"),
    count: z.number(),
    nextPost: z.string()
});

const TrackPerformanceSchema = z.object({
    campaignId: z.string(),
    metrics: z.object({
        impressions: z.number(),
        clicks: z.number(),
        conversions: z.number()
    }),
    roi: z.string()
});

// --- Tools Implementation ---

export const MarketingTools = {
    create_campaign_brief: async ({ product, goal, budget, duration }: { product: string; goal: string; budget?: string; duration?: string }) => {
        const schema = zodToJsonSchema(CreateCampaignBriefSchema);
        const prompt = `
        You are a Marketing Strategist. Create a campaign brief for: ${product}.
        Goal: ${goal}.
        ${budget ? `Budget: ${budget}` : ''}
        ${duration ? `Duration: ${duration}` : ''}
        `;
        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(CreateCampaignBriefSchema.parse(data));
        } catch (error) {
            console.error('MarketingTools.create_campaign_brief error:', error);
            return JSON.stringify({
                campaignName: `${product} Campaign`,
                targetAudience: "General Audience",
                budget: "TBD",
                channels: [],
                kpis: []
            });
        }
    },

    analyze_audience: async ({ genre, similar_artists }: { genre: string; similar_artists?: string[] }) => {
        const schema = zodToJsonSchema(AnalyzeAudienceSchema);
        const prompt = `
        You are a Market Researcher. Analyze the target audience for genre: ${genre}.
        ${similar_artists ? `Similar Artists: ${similar_artists.join(', ')}` : ''}
        `;
        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(AnalyzeAudienceSchema.parse(data));
        } catch (error) {
            console.error('MarketingTools.analyze_audience error:', error);
            return JSON.stringify({
                platform: "General",
                demographics: { age: "Unknown", locations: [] },
                interests: [],
                reach: "Unknown"
            });
        }
    },

    schedule_content: async ({ campaign_start, platforms, frequency }: { campaign_start: string; platforms: string[]; frequency: string }) => {
        const schema = zodToJsonSchema(ScheduleContentSchema);
        const prompt = `
        You are a Content Scheduler. Plan a schedule starting ${campaign_start}.
        Platforms: ${platforms.join(', ')}.
        Frequency: ${frequency}.
        `;
        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(ScheduleContentSchema.parse(data));
        } catch (error) {
            console.error('MarketingTools.schedule_content error:', error);
            return JSON.stringify({
                status: "scheduled",
                count: 0,
                nextPost: "Unknown"
            });
        }
    },

    track_performance: async ({ campaignId }: { campaignId: string }) => {
        const schema = zodToJsonSchema(TrackPerformanceSchema);
        const prompt = `
        You are a Marketing Analyst. Generate a simulated performance report for Campaign ID: ${campaignId}.
        `;
        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(TrackPerformanceSchema.parse(data));
        } catch (error) {
            console.error('MarketingTools.track_performance error:', error);
            return JSON.stringify({
                campaignId,
                metrics: { impressions: 0, clicks: 0, conversions: 0 },
                roi: "0%"
            });
        }
    }
};

// Backwards compatibility exports
export const create_campaign_brief = MarketingTools.create_campaign_brief;
export const analyze_audience = MarketingTools.analyze_audience;
export const schedule_content = MarketingTools.schedule_content;
export const track_performance = MarketingTools.track_performance;
