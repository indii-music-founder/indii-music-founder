import { AgentConfig } from "../types";
import systemPrompt from '@agents/social/prompt.md?raw';

export const SocialAgent: AgentConfig = {
    id: 'social',
    name: 'Social Media Department',
    description: 'Manages social media presence, trends, and community engagement.',
    color: 'bg-blue-400',
    category: 'department',
    systemPrompt,
    functions: {
        analyze_trends: async (args: { topic: string }) => {
            return {
                trend_score: 85,
                sentiment: "positive",
                keywords: ["viral", "trending", "hot"],
                summary: `The topic '${args.topic}' is currently trending with positive sentiment.`
            };
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
