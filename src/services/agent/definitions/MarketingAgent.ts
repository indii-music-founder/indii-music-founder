import { AgentConfig } from "../types";
import systemPrompt from '@agents/marketing/prompt.md?raw';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import { useStore } from '@/core/store';

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
        },
        generate_campaign_from_audio: async (args: { uploadedAudioIndex: number }) => {
            const { uploadedAudio } = useStore.getState();
            const audioItem = uploadedAudio[args.uploadedAudioIndex || 0];

            if (!audioItem) {
                return { success: false, error: "No audio found. Please upload audio first." };
            }

            try {
                const fetchRes = await fetch(audioItem.url);
                const blob = await fetchRes.blob();
                const file = new File([blob], "audio_track.mp3", { type: blob.type });

                const profile = await audioIntelligence.analyze(file);
                const { mood, genre, marketingHooks } = profile.semantic;

                return {
                    success: true,
                    data: {
                        insight: `Analyzed track. Genre: ${genre.join(', ')}. Mood: ${mood.join(', ')}.`,
                        suggested_one_liner: marketingHooks.oneLiner,
                        keywords: marketingHooks.keywords,
                        technical: profile.technical
                    }
                };
            } catch (e: any) {
                return { success: false, error: e.message };
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
            },
            {
                name: 'generate_campaign_from_audio',
                description: 'Analyze an audio track to generate marketing insights and campaign hooks.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        uploadedAudioIndex: { type: 'NUMBER', description: 'Index of audio file in uploads (default 0).' }
                    },
                    required: []
                }
            }
        ]
    }]
};
