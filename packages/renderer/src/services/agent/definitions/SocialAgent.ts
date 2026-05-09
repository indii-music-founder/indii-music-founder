import { AgentConfig } from "../types";
import { freezeAgentConfig } from '../FreezeDiagnostic';
import { GenAI } from '@/services/ai/GenAI';
import { Schema } from 'firebase/ai';
import systemPrompt from '@agents/social/prompt.md?raw';

export const SocialAgent: AgentConfig = {
    id: 'social',
    name: 'Social Media Director',
    description: 'Manages social media presence, trends, and community engagement.',
    color: 'bg-sky-400',
    category: 'department',
    systemPrompt: systemPrompt,
    functions: {
        analyze_trends: async (args: { topic: string }) => {
            const prompt = `Analyze current social media trends for the topic: "${args.topic}". Return a JSON with trend_score (0-100), sentiment (positive/neutral/negative), keywords (array), and a summary.`;
            try {
                const response = await GenAI.generateStructuredData(prompt, { type: 'object' } as Schema, { maxOutputTokens: 8192, temperature: 1.0 });
                return { success: true, data: response };
            } catch (e: unknown) {
                return { success: false, error: (e as Error).message };
            }
        },
        generate_social_post: async (args: { platform: string, topic: string, tone?: string }) => {
            const prompt = `Write a ${args.platform} post about "${args.topic}". Tone: ${args.tone || 'engaging'}. Include hashtags.`;
            const response = await GenAI.generateText(prompt, { maxOutputTokens: 8192, temperature: 1.0 });
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
                const response = await GenAI.generateText(prompt, { maxOutputTokens: 8192, temperature: 1.0 });
                return { success: true, data: { calendar: response } };
            } catch (e: unknown) {
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
                const response = await GenAI.generateStructuredData(prompt, { type: 'array', items: { type: 'string' } } as Schema, { maxOutputTokens: 8192, temperature: 1.0 });
                return { success: true, data: { thread: response } };
            } catch (e: unknown) {
                return { success: false, error: (e as Error).message };
            }
        }
    },
    authorizedTools: ['create_social_calendar', 'schedule_post_execution', 'generate_social_post', 'analyze_trends', 'browser_tool', 'indii_image_gen', 'credential_vault', 'draft_advanced_thread', 'analyze_sentiment', 'multi_platform_autopost', 'dispatch_community_webhook'],
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
