import { AgentConfig } from "../types";
import { AutonomousTools } from '../tools/AutonomousTools';
import { MarketingTools } from '../tools/MarketingTools';
import { UniversalTools } from '../tools/UniversalTools';
import systemPrompt from '@agents/marketing/prompt.md?raw';

export const MarketingAgent: AgentConfig = {
    id: 'marketing',
    name: 'Marketing Director',
    description: 'Orchestrates multi-channel marketing campaigns, strategy, and content calendars.',
    color: 'bg-orange-500',
    category: 'department',
    systemPrompt: systemPrompt,
    get functions() {
        return {
            create_campaign_brief: MarketingTools.create_campaign_brief,
            analyze_audience: MarketingTools.analyze_audience,
            schedule_content: MarketingTools.schedule_content,
            track_performance: MarketingTools.track_performance,
            generate_campaign_from_audio: MarketingTools.generate_campaign_from_audio,
            browser_tool: UniversalTools.browser_tool,
            indii_image_gen: UniversalTools.indii_image_gen,
            create_artifact_drop: AutonomousTools.create_artifact_drop,
            generate_ab_campaign: MarketingTools.generate_ab_campaign,
            deploy_micro_ad_campaign: MarketingTools.deploy_micro_ad_campaign,
            deploy_email_newsletter: MarketingTools.deploy_email_newsletter,
            generate_presave_campaign: MarketingTools.generate_presave_campaign,
            deploy_sms_blast: MarketingTools.deploy_sms_blast,
            enrich_fan_data: MarketingTools.enrich_fan_data,
            generate_influencer_bounty: MarketingTools.generate_influencer_bounty,
        } as Record<string, import('@/services/agent/types').AnyToolFunction>;
    },
    authorizedTools: ['create_campaign_brief', 'analyze_audience', 'schedule_content', 'track_performance', 'generate_campaign_from_audio', 'browser_tool', 'indii_image_gen', 'create_artifact_drop', 'generate_ab_campaign', 'deploy_micro_ad_campaign', 'deploy_email_newsletter', 'generate_presave_campaign', 'deploy_sms_blast', 'enrich_fan_data', 'generate_influencer_bounty'],
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
            },
            {
                name: "browser_tool",
                description: "Research market trends, competitor ads, or platform algorithms.",
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
                description: "Generate ad creative, moodboards, or mockups.",
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
                name: "create_artifact_drop",
                description: "Creates an 'Independent Artifact Drop' - a high-value purchase link for creative assets. Packages artwork, audio, and a generated license into a single commercial artifact.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING", description: "Title of the artifact." },
                        description: { type: "STRING", description: "Marketing description for the drop." },
                        priceUsd: { type: "NUMBER", description: "Price in USD." },
                        artworkUrl: { type: "STRING", description: "Public URL of the artwork." },
                        audioUrl: { type: "STRING", description: "Optional public URL of the audio track." },
                        licenseType: { type: "STRING", enum: ["Personal", "Commercial", "Exclusive"] }
                    },
                    required: ["title", "description", "priceUsd", "artworkUrl", "licenseType"]
                }
            },
            {
                name: "generate_ab_campaign",
                description: "Generates 3 variants of ad copy for A/B testing and outputs a tracking pixel snippet for campaign analytics.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        productName: { type: "STRING", description: "The song, merch, or tour being advertised." },
                        targetAudience: { type: "STRING", description: "The intended demographic." },
                        platform: { type: "STRING", enum: ["Meta", "TikTok", "YouTube"], description: "The advertising platform." }
                    },
                    required: ["productName", "targetAudience", "platform"]
                }
            },
            {
                name: "deploy_micro_ad_campaign",
                description: "Deploys a micro-budget ($10/day) ad campaign across Meta or TikTok Graph APIs, utilizing A/B tested creatives.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        platform: { type: "STRING", enum: ["Meta", "TikTok"], description: "The ad platform to deploy to." },
                        dailyBudgetUsd: { type: "NUMBER", description: "Daily budget in USD (usually $10)." },
                        durationDays: { type: "NUMBER", description: "How many days the ad should run." },
                        targetAudienceProfile: { type: "STRING", description: "JSON or string defining age, geo, and interests." },
                        creativeVariants: { type: "ARRAY", items: { type: "STRING" }, description: "List of creative post IDs or URLs to test." }
                    },
                    required: ["platform", "dailyBudgetUsd", "durationDays", "targetAudienceProfile", "creativeVariants"]
                }
            },
            {
                name: "deploy_email_newsletter",
                description: "Syncs with Mailchimp/Klaviyo APIs to deploy a custom HTML newsletter template to a specific audience segment.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        subjectLine: { type: "STRING", description: "The email subject line." },
                        segmentName: { type: "STRING", enum: ["All Fans", "Superfans", "VIPs", "Pre-savers"], description: "The audience segment to target." },
                        htmlContent: { type: "STRING", description: "The raw HTML body of the newsletter." },
                        sendAt: { type: "STRING", description: "Optional ISO timestamp to schedule the send. Leave empty to send immediately." }
                    },
                    required: ["subjectLine", "segmentName", "htmlContent"]
                }
            },
            {
                name: "generate_presave_campaign",
                description: "Generates a responsive pre-save landing page designed to collect fan emails/phone numbers before release.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackTitle: { type: "STRING", description: "The title of the unreleased track." },
                        releaseDate: { type: "STRING", description: "ISO timestamp of the release date." },
                        artworkUrl: { type: "STRING", description: "URL of the cover art." },
                        collectPhoneNumbers: { type: "BOOLEAN", description: "Whether to include an SMS opt-in field." }
                    },
                    required: ["trackTitle", "releaseDate", "artworkUrl"]
                }
            },
            {
                name: "deploy_sms_blast",
                description: "Hooks into Twilio APIs to send direct SMS blasts to a segmented superfan list for surprise drops or pre-saves.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        messageBody: { type: "STRING", description: "The SMS content (keep under 160 characters)." },
                        segmentName: { type: "STRING", enum: ["Superfans", "VIPs", "Pre-savers"], description: "The audience segment to target." },
                        mediaUrl: { type: "STRING", description: "Optional MMS media URL (e.g., a GIF or image to attach)." }
                    },
                    required: ["messageBody", "segmentName"]
                }
            },
            {
                name: "enrich_fan_data",
                description: "Uses external APIs (like Clearbit/Apollo) to enrich a raw fan email address with demographic insights and social links.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        emailAddress: { type: "STRING", description: "The fan's email address to enrich." }
                    },
                    required: ["emailAddress"]
                }
            },
            {
                name: "generate_influencer_bounty",
                description: "Creates a tracked referral link campaign for micro-influencers to use the artist's sound on TikTok/Reels.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackTitle: { type: "STRING", description: "The track to promote." },
                        bountyRewardUsd: { type: "NUMBER", description: "The payout amount per 10k views (or flat fee)." },
                        soundUrl: { type: "STRING", description: "The official TikTok sound URL." },
                        targetInfluencerNiche: { type: "STRING", description: "e.g., 'Fitness Creators', 'Dance', 'Gaming'" }
                    },
                    required: ["trackTitle", "bountyRewardUsd", "soundUrl"]
                }
            }
        ]
    }]

};

import { freezeAgentConfig } from '../FreezeDiagnostic';

// Freeze the schema to prevent cross-test contamination
freezeAgentConfig(MarketingAgent);
