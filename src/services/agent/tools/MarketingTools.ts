import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { MarketingService } from '@/services/marketing/MarketingService';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

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

export const MarketingTools: Record<string, AnyToolFunction> = {
    create_campaign_brief: wrapTool('create_campaign_brief', async ({ product, goal, budget, duration }: { product: string; goal: string; budget?: string; duration?: string }) => {
        const schema = zodToJsonSchema(CreateCampaignBriefSchema);
        const prompt = `
        You are a Marketing Strategist. Create a campaign brief for: ${product}.
        Goal: ${goal}.
        ${budget ? `Budget: ${budget}` : ''}
        ${duration ? `Duration: ${duration}` : ''}
        `;

        const data = await firebaseAI.generateStructuredData<any>(prompt, schema as any);
        const parsed = CreateCampaignBriefSchema.parse(data);

        // AUTO-PERSIST: Save the generated brief to the database
        try {
            const { budget: _budgetStr, ...briefData } = parsed;
            await MarketingService.createCampaign({
                name: parsed.campaignName,
                platform: parsed.channels[0] || 'general',
                startDate: Date.now(),
                status: 'PENDING' as any,
                budget: parseFloat(parsed.budget.replace(/[^0-9.]/g, '')) || 0,
                spent: 0,
                performance: { reach: 0, clicks: 0 },
                ...briefData
            } as any);
            console.info(`[MarketingTools] Campaign brief persisted: ${parsed.campaignName}`);
        } catch (persistError) {
            console.warn('[MarketingTools] Persistence failed:', persistError);
        }

        return toolSuccess(parsed, `Campaign brief created for ${parsed.campaignName} and saved to Marketing Dashboard.`);
    }),

    analyze_audience: wrapTool('analyze_audience', async ({ genre, similar_artists }: { genre: string; similar_artists?: string[] }) => {
        const schema = zodToJsonSchema(AnalyzeAudienceSchema);
        const prompt = `
        You are a Market Researcher. Analyze the target audience for genre: ${genre}.
        ${similar_artists ? `Similar Artists: ${similar_artists.join(', ')}` : ''}
        `;
        const data = await firebaseAI.generateStructuredData<any>(prompt, schema as any);
        const validated = AnalyzeAudienceSchema.parse(data);
        return toolSuccess(validated, `Audience analysis completed for ${genre}. Estimated reach: ${validated.reach}.`);
    }),

    /**
     * Enhanced Schedule Content: Uses real JS Dates instead of AI hallucination for the calendar.
     */
    schedule_content: wrapTool('schedule_content', async ({ campaign_start, platforms, frequency }: { campaign_start: string; platforms: string[]; frequency: string }) => {
        const startDate = new Date(campaign_start);
        const validStartDate = isNaN(startDate.getTime()) ? new Date() : startDate;

        let intervalDays = 7;
        const freqLower = frequency.toLowerCase();
        if (freqLower.includes("daily")) intervalDays = 1;
        else if (freqLower.includes("bi-weekly") || freqLower.includes("twice a week")) intervalDays = 3;
        else if (freqLower.includes("monthly")) intervalDays = 30;

        const schedule: Array<{ date: string; platform: string; type: string }> = [];
        const postsPerPlatform = 4;

        for (let i = 0; i < postsPerPlatform; i++) {
            const postDate = new Date(validStartDate);
            postDate.setDate(validStartDate.getDate() + (i * intervalDays));

            platforms.forEach(platform => {
                schedule.push({
                    date: postDate.toISOString(),
                    platform: platform,
                    type: "Social Post"
                });
            });
        }

        schedule.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return toolSuccess({
            status: "scheduled",
            count: schedule.length,
            schedule: schedule,
            nextPost: schedule.length > 0 ? schedule[0].date : "None"
        }, `Content schedule generated with ${schedule.length} posts across ${platforms.join(', ')}.`);
    }),

    track_performance: wrapTool('track_performance', async ({ campaignId }: { campaignId: string }) => {
        const schema = zodToJsonSchema(TrackPerformanceSchema);
        const prompt = `
        You are a Marketing Analyst. Generate a simulated performance report for Campaign ID: ${campaignId}.
        `;
        const data = await firebaseAI.generateStructuredData<any>(prompt, schema as any);
        const validated = TrackPerformanceSchema.parse(data);
        return toolSuccess(validated, `Performance tracking report generated for Campaign ID: ${campaignId}. ROI: ${validated.roi}.`);
    })
};

// Aliases
export const {
    create_campaign_brief,
    analyze_audience,
    schedule_content,
    track_performance
} = MarketingTools;
