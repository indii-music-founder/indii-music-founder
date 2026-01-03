import { AgentConfig } from "../types";
import systemPrompt from '@agents/marketing/prompt.md?raw';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

export const MarketingAgent: AgentConfig = {
    id: 'marketing',
    name: 'Marketing Department',
    description: 'Orchestrates multi-channel marketing campaigns, strategy, and content calendars.',
    color: 'bg-orange-500',
    category: 'manager',
    systemPrompt,
    functions: {
        create_campaign_brief: async (args: { product: string, goal: string }) => {
            const prompt = `Create a detailed Campaign Marketing Brief.
            Product: ${args.product}
            Goal: ${args.goal}
            
            Include:
            - Target Audience Segments
            - Key Messaging / Positioning
            - Channel Strategy (Social, Email, PR)
            - Estimated Budget Allocation (Percent)
            - Success Metrics (KPIs)`;

            try {
                const response = await firebaseAI.generateText(prompt);
                return { success: true, data: { brief: response } };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        },
        analyze_audience: async (args: { platform: string }) => {
            const prompt = `Analyze the current audience trends and demographics for the music industry on ${args.platform}.
            
            Provide:
            - Age / Gender breakdown (General approximations)
            - Content preferences
            - Engagement patterns
            - Best times to post`;

            try {
                const response = await firebaseAI.generateText(prompt);
                return { success: true, data: { analysis: response } };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        },
        schedule_content: async (args: { posts: any[] }) => {
            // Future: Call SocialService.schedulePost
            const prompt = `Simulate scheduling posts. Count: ${args.posts.length}. Return a confirmation message.`;
            const confirmation = await firebaseAI.generateText(prompt);
            return {
                success: true,
                data: {
                    status: "Scheduled",
                    scheduled_count: args.posts.length,
                    platform_response: confirmation
                }
            };
        },
        track_performance: async (args: { campaignId: string }) => {
            const prompt = `Generate a realistic performance report for campaign "${args.campaignId}". Metrics: Impressions, Clicks, CTR, ROI. Return as JSON.`;
            try {
                const response = await firebaseAI.generateStructuredData(prompt, { type: 'object' } as any);
                return { success: true, data: response };
            } catch (e) {
                return { success: false, error: (e as Error).message };
            }
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: 'create_campaign_brief',
                description: 'Generate a structured campaign brief including target audience, budget, and channels.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        product: { type: 'STRING', description: 'The product or release to market.' },
                        goal: { type: 'STRING', description: 'The primary goal of the campaign (e.g., "1M streams").' }
                    },
                    required: ['product', 'goal']
                }
            },
            {
                name: 'analyze_audience',
                description: 'Analyze demographics and interests for a specific platform.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        platform: { type: 'STRING', description: 'The platform to analyze (e.g., "TikTok", "Spotify").' }
                    },
                    required: ['platform']
                }
            },
            {
                name: 'schedule_content',
                description: 'Schedule a batch of content posts.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        posts: {
                            type: 'ARRAY',
                            description: 'List of post objects with dates and content.',
                            items: { type: 'OBJECT' }
                        }
                    },
                    required: ['posts']
                }
            },
            {
                name: 'track_performance',
                description: 'Get performance metrics for a specific campaign.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        campaignId: { type: 'STRING', description: 'The ID of the campaign to track.' }
                    },
                    required: ['campaignId']
                }
            }
        ]
    }]
};
