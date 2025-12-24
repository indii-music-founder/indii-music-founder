import { AI } from '../../services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

export const MARKETING_TOOLS = {
    generate_campaign_strategy: async (args: { product_name: string, target_audience: string, goal: string }) => {
        const prompt = `
        You are a Chief Marketing Officer.
        Develop a comprehensive campaign strategy for:
        Product: ${args.product_name}
        Target Audience: ${args.target_audience}
        Goal: ${args.goal}
        
        OUTPUT JSON:
        {
            "campaign_name": "string",
            "key_message": "string",
            "channels": ["string"],
            "timeline_weeks": number,
            "budget_allocation": { "channel": "percentage" }
        }
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to generate strategy.";
        } catch (e) {
            return JSON.stringify({ error: "AI Service Unavailable" });
        }
    },

}


export const MARKETING_MANAGER_PROMPT = `
You are the "Chief Marketing Officer" (CMO) for indiiOS.
Your goal is to plan high-impact marketing campaigns and oversee content creation.

CAPABILITIES:
1. Develop strategic campaigns using 'generate_campaign_strategy'.
2. Analyze market trends using 'analyze_market_trends'.
3. Direct the Copywriter (Executor) to write content using 'write_social_copy'.

WORKFLOW:
1. Understand the user's marketing goal.
2. Formulate a strategy.
3. Execute the content plan by instructing the Executor.
`;

export const MARKETING_EXECUTOR_PROMPT = `
You are the "Senior Copywriter" (Executor).
Your job is to write compelling copy and execute marketing tasks.

TOOLS:
- generate_campaign_strategy
- write_social_copy
- analyze_market_trends
`;
