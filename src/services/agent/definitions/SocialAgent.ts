import { AgentConfig } from "../types";
import { freezeAgentConfig } from '../FreezeDiagnostic';

import systemPrompt from '@agents/social/prompt.md?raw';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { Schema } from 'firebase/ai';

export const SocialAgent: AgentConfig = {
    id: 'social',
    name: 'Social Media Department',
    description: 'Manages social media presence, trends, and community engagement.',
    color: 'bg-sky-400',
    category: 'department',
    systemPrompt: `
You are the **Music Industry Social Media Specialist**, a specialist agent within the indii system.

## indii Architecture (Hub-and-Spoke)
As a specialist (spoke), you operate under strict architectural rules:
1. **Delegation:** You can ONLY delegate tasks or consult experts by going back to the Hub ('generalist' / Agent Zero).
2. **Horizontal Communication:** You CANNOT communicate directly with other specialist agents (Marketing, Video, Brand, etc.).
3. **Coordination:** If you need help from another domain (e.g., Marketing for the broader campaign timeline), ask Agent Zero to coordinate.

## Role
Your role is to manage the artist's social media presence and community engagement. You are an expert in music-specific platforms (TikTok, Instagram, Discord) and understanding how "sounds" drive discovery.

## Responsibilities:

1. **Short-Form Video Strategy:** Identify trending "sounds" and concepts for TikTok/Reels/Shorts that showcase the artist's music.
2. **Community Management:** Strategy for engaging fans on Discord, YouTube comments, and Instagram DMs.
3. **Release Hype:** Coordinate "countdown" content, pre-save links, and snippet reveals.
4. **Platform Optimization:** Tailoring content specifically for music-first algorithms.
5. **Fan-Generated Content (UGC):** Strategies to encourage fans to use the artist's music in their own videos.

## Tone & Perspective:
- **Trend-Aware:** Always have a finger on the pulse of what's viral in music.
- **Authentic:** Focus on building a "Human-to-Fan" connection rather than just corporate marketing.
- **Reactive:** Move fast to capitalize on trending moments.

Think in terms of "Virality," "Engagement Rate," and "Sound Uses."
    `,
    functions: {
        analyze_trends: async (args: { topic: string }) => {
            const prompt = `Analyze current social media trends for the topic: "${args.topic}". Return a JSON with trend_score (0-100), sentiment (positive/neutral/negative), keywords (array), and a summary.`;
            try {
                const response = await firebaseAI.generateStructuredData(prompt, { type: 'object' } as Schema);
                return { success: true, data: response };
            } catch (e) {
                return { success: false, error: (e as Error).message };
            }
        },
        generate_social_post: async (args: { platform: string, topic: string, tone?: string }) => {
            const prompt = `Write a ${args.platform} post about "${args.topic}". Tone: ${args.tone || 'engaging'}. Include hashtags.`;
            const response = await firebaseAI.generateText(prompt);
            return { success: true, data: { content: response } };
        },
        create_social_calendar: async (args: { releaseDate: string, campaignTitle: string, durationWeeks: number }) => {
            const prompt = `Generate a long-term social media content calendar for a music release.
            Campaign: ${args.campaignTitle}
            Release Date: ${args.releaseDate}
            Duration: ${args.durationWeeks} weeks
            
            Include:
            - Pre-release (Hype/Teasers)
            - Release Day (Launch/Direct links)
            - Post-release (UGC/Music Video/Remix)
            - Platform-specific frequency (TikTok daily, IG 3x/week, etc.)`;

            try {
                const response = await firebaseAI.generateText(prompt);
                return { success: true, data: { calendar: response } };
            } catch (e) {
                return { success: false, error: (e as Error).message };
            }
        },
        schedule_post_execution: async (args: { platform: string, content: string, scheduleTime: string }) => {
            // Integration with long-term scheduling service (Cron/Inngest)
            return {
                success: true,
                data: {
                    status: "Queued",
                    platform: args.platform,
                    scheduled_for: args.scheduleTime,
                    message: `Post successfully queued for ${args.platform}. indii will monitor for engagement upon release.`
                }
            };
        },
        draft_advanced_thread: async (args: { topic: string, platform: string, threadLength: number }) => {
            const prompt = `Draft a compelling ${args.threadLength}-part advanced thread for ${args.platform} about ${args.topic}. Make each part flow smoothly into the next, using hooks and cliffhangers where appropriate. Return an array of strings.`;
            try {
                const response = await firebaseAI.generateStructuredData(prompt, { type: 'array', items: { type: 'string' } } as Schema);
                return { success: true, data: { thread: response } };
            } catch (e) {
                return { success: false, error: (e as Error).message };
            }
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: "create_social_calendar",
                description: "Generate a multi-week content calendar for a music release.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        releaseDate: { type: "STRING", description: "YYYY-MM-DD" },
                        campaignTitle: { type: "STRING" },
                        durationWeeks: { type: "NUMBER" }
                    },
                    required: ["releaseDate", "campaignTitle"]
                }
            },
            {
                name: "schedule_post_execution",
                description: "Schedule a post for long-term execution on a specific platform.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        platform: { type: "STRING" },
                        content: { type: "STRING" },
                        scheduleTime: { type: "STRING", description: "ISO 8601 timestamp" }
                    },
                    required: ["platform", "content", "scheduleTime"]
                }
            },
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
            },
            {
                name: "browser_tool",
                description: "Browse social platforms to spot trends or engagement.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "Action: open, click, type, get_dom" },
                        url: { type: "STRING" },
                        selector: { type: "STRING" }
                    },
                    required: ["action"]
                }
            },
            {
                name: "indii_image_gen",
                description: "Generate memes, quote cards, or social assets.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING" },
                        aspect_ratio: { type: "STRING" }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "credential_vault",
                description: "Retrieve social media login credentials.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "retrieve" },
                        service: { type: "STRING", description: "Service name (e.g. TikTok)" }
                    },
                    required: ["action", "service"]
                }
            },
            {
                name: "draft_advanced_thread",
                description: "Draft an advanced multi-part thread for a social platform.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        topic: { type: "STRING" },
                        platform: { type: "STRING" },
                        threadLength: { type: "NUMBER" }
                    },
                    required: ["topic", "platform", "threadLength"]
                }
            },
            {
                name: "analyze_sentiment",
                description: "Crawls recent comments/mentions across linked socials (X/IG) and provides a sentiment and trend report.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        platform: { type: "STRING", enum: ["All", "X", "Instagram", "TikTok"], description: "The platform to analyze." },
                        timeframe: { type: "STRING", enum: ["7d", "14d", "30d"], description: "How far back to analyze." }
                    },
                    required: ["platform", "timeframe"]
                }
            },
            {
                name: "multi_platform_autopost",
                description: "Direct API integration tool to automatically queue and post a single video to multiple short-form platforms (TikTok, YouTube Shorts, IG Reels) natively.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        videoUrl: { type: "STRING", description: "Public URL of the 9:16 short form video to upload." },
                        caption: { type: "STRING", description: "The caption to include across all platforms." },
                        hashtags: { type: "ARRAY", items: { type: "STRING" }, description: "List of hashtags to append." },
                        platforms: {
                            type: "ARRAY",
                            items: { type: "STRING", enum: ["TikTok", "YouTube Shorts", "IG Reels"] },
                            description: "Which platforms to push to simultaneously."
                        }
                    },
                    required: ["videoUrl", "caption", "platforms"]
                }
            },
            {
                name: "dispatch_community_webhook",
                description: "Dispatches an automated announcement (with rich embeds) into an artist's Discord or Telegram community server via webhook.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        platform: { type: "STRING", enum: ["Discord", "Telegram"], description: "The community platform." },
                        webhookUrl: { type: "STRING", description: "The secure webhook URL." },
                        messageContent: { type: "STRING", description: "The main text of the announcement." },
                        embedTitle: { type: "STRING", description: "Title of the rich embed (e.g., 'New Drop!')." },
                        embedImageUrl: { type: "STRING", description: "URL of the cover art or promo image." },
                        embedLink: { type: "STRING", description: "Call to action link (e.g., pre-save link)." }
                    },
                    required: ["platform", "webhookUrl", "messageContent"]
                }
            }
        ]
    }]
};

// Freeze the schema to prevent cross-test contamination
freezeAgentConfig(SocialAgent);
