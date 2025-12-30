import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

export const MarketingTools = {
    create_campaign_brief: async (args: { product: string, goal: string, budget?: string, duration?: string }) => {
        const prompt = `
        You are a Marketing Strategist. Create a detailed Campaign Brief.

        Product/Release: ${args.product}
        Goal: ${args.goal}
        Budget: ${args.budget || 'Not specified'}
        Duration: ${args.duration || 'Not specified'}

        Structure:
        1. Executive Summary
        2. Target Audience
        3. Key Messages
        4. Channels & Tactics
        5. Timeline (Week by Week)
        6. Budget Allocation
        7. KPIs
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to create campaign brief.";
        } catch (e) {
            return "Error creating campaign brief.";
        }
    },

    analyze_audience: async (args: { genre: string, similar_artists?: string[] }) => {
        const prompt = `
        You are a Data Analyst. Provide an Audience Analysis Profile.

        Genre: ${args.genre}
        Similar Artists: ${args.similar_artists?.join(', ') || 'None provided'}

        Include:
        1. Demographics (Age, Gender, Location)
        2. Psychographics (Interests, Values)
        3. Listening Habits
        4. Preferred Social Platforms
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to analyze audience.";
        } catch (e) {
            return "Error analyzing audience.";
        }
    },

    schedule_content: async (args: { campaign_start: string, platforms: string[], frequency: string }) => {
        const prompt = `
        You are a Social Media Manager. Create a Content Calendar.

        Start Date: ${args.campaign_start}
        Platforms: ${args.platforms.join(', ')}
        Frequency: ${args.frequency}

        Generate a table with: Date, Platform, Content Idea, Caption Draft, Asset Needed.
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to schedule content.";
        } catch (e) {
            return "Error scheduling content.";
        }
    }
};
