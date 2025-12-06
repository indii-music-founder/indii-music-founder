import { BaseAgent } from './BaseAgent';
import { SocialTools } from '../tools/SocialTools';

export class SocialAgent extends BaseAgent {
    id = 'social';
    name = 'Social Media Department'; // Explicitly named as requested
    description = 'Manages social media presence, trends, and community engagement.';
    color = 'bg-blue-400';
    category = 'department' as const;
    systemPrompt = `You are the Social Media Department.
    Your role is to manage the brand's online presence, engage with the community, and track trends.

    Responsibilities:
    1. Create engaging social content.
    2. Monitor trends and sentiment.
    3. Interact with the community in the brand's voice.

    Be trendy, responsive, and engaging.`;

    tools = [{
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
                name: "analyze_trends", // Mock tool for now
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
    }];

    constructor() {
        super();
        this.functions = {
            // Mock implementation for analyze_trends
            analyze_trends: async (args: { topic: string }) => {
                return {
                    trend_score: 85,
                    sentiment: "positive",
                    keywords: ["viral", "trending", "hot"],
                    summary: `The topic '${args.topic}' is currently trending with positive sentiment.`
                };
            },
            // Reuse social tool logic via registry if needed, or implement here.
            // But wait, BaseAgent uses TOOL_REGISTRY for things not in this.functions.
            // SocialTools.generate_social_post is in TOOL_REGISTRY (via tools.ts export).
            // Let's verify tools.ts exports SocialTools.
        };
    }
}
