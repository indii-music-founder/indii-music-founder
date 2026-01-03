import { AgentConfig } from "../types";
import systemPrompt from '@agents/social/prompt.md?raw';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

export const SocialAgent: AgentConfig = {
    id: 'social',
    name: 'Social Media Department',
    description: 'Manages social media presence, trends, and community engagement.',
    color: 'bg-blue-400',
    category: 'department',
    systemPrompt,
    functions: {
        analyze_trends: async (args: { topic: string }) => {
            const prompt = `Analyze current social media trends for the topic: "${args.topic}". Return a JSON with trend_score (0-100), sentiment (positive/neutral/negative), keywords (array), and a summary.`;
            try {
                const response = await firebaseAI.generateStructuredData(prompt, { type: 'object' } as any);
                return { success: true, data: response };
            } catch (e) {
                return { success: false, error: (e as Error).message };
            }
        },
        generate_social_post: async (args: { platform: string, topic: string, tone?: string }) => {
            const prompt = `Write a ${args.platform} post about "${args.topic}". Tone: ${args.tone || 'engaging'}. Include hashtags.`;
            const response = await firebaseAI.generateText(prompt);
            return { success: true, data: { content: response } };
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: "generate_social_post",
                description: "Generate a social media post.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        platform: { type: "STRING", description: "Platform (Twitter, LinkedIn, Instagram, etc)." },
                        topic: { type: "STRING", description: "What the post is about." },
                        tone: { type: "STRING", description: "Desired tone." }
                    },
                    required: ["platform", "topic"]
                }
            },
            {
                name: "analyze_trends",
                description: "Analyze current trends for a topic.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        topic: { type: "STRING", description: "Topic to analyze." }
                    },
                    required: ["topic"]
                }
            }
        ]
    }]
};
