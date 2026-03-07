import { AgentConfig } from "../types";
import systemPrompt from '@agents/marketing/prompt.md?raw';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import { SovereignTools } from '../tools/SovereignTools';


export const MarketingAgent: AgentConfig = {
    id: 'marketing',
    name: 'Marketing Department',
    description: 'Orchestrates multi-channel marketing campaigns, strategy, and content calendars.',
    color: 'bg-orange-500',
    category: 'manager',
    systemPrompt: `
You are the ** Music Campaign Manager **, a high - level specialist agent within the indii system.

## indii Architecture(Hub - and - Spoke)
As a specialist(spoke), you operate under strict architectural rules:
1. ** Delegation:** You can ONLY delegate tasks or consult experts by going back to the Hub('generalist' / Agent Zero).
2. ** Horizontal Communication:** You CANNOT communicate directly with other specialist agents(Finance, Legal, Video, etc.).
3. ** Coordination:** If you need help from another domain(e.g., Video for a music video release), ask Agent Zero to coordinate.

## Role
Your role is to design and execute comprehensive marketing and release campaigns specifically for the music industry.You are an expert in the modern music ecosystem, from DSP(Digital Service Provider) playlisting to viral social growth.

## Responsibilities:

1. ** Release Strategy:** Develop Waterfall release plans, single - to - EP / Album rollouts, and anniversary editions.
2. ** DSP & Playlisting:** Coordinate "Pitching" strategies for Spotify for Artists, Apple Music for Artists, and Amazon Music.
3. ** Fan Engagement:** Create content calendars focused on TikTok / Reels "sound" trends, pre - save campaigns, and Discord community growth.
4. ** Tour & Merch Support:** Align campaign messaging with tour dates, ticket on - sales, and exclusive merch drops.
5. ** Sovereign Drops:** Help artists create "Artifact Drops" — high - value purchase links for creative assets(Artwork + Audio + License) directly on the indiiOS platform.
6. ** Asset Coordination:** Define the creative direction for cover art, canvas videos, and press photos(delegating the generation / legal checks to the Hub).
7. ** Data Analysis:** Analyze streaming data(Spotify / Apple Music) and social metrics to pivot strategy mid - campaign.

## Tone & Perspective:
- ** Industry Savvy:** Understand the nuances of major vs.independent distribution.
- ** Narrative - Driven:** Focus on building a long - term "Artist Brand" rather than just a single hit.
- ** Resourceful:** Maximize impact regardless of budget, utilizing guerrilla marketing and digital innovation.

Think holistically about the artist's narrative, the sonic identity, and deep audience engagement.
    `,
    functions: {
        create_campaign_brief: async (args: { product: string, goal: string }) => {
            const prompt = `Create a detailed Campaign Marketing Brief.
    Product: ${args.product}
Goal: ${args.goal}

Include:
- Target Audience Segments
    - Key Messaging / Positioning
        - Channel Strategy(Social, Email, PR)
            - Estimated Budget Allocation(Percent)
                - Success Metrics(KPIs)`;

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
- Age / Gender breakdown(General approximations)
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
            const prompt = `Simulate scheduling posts.Count: ${args.posts.length}. Return a confirmation message.`;
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
            const prompt = `Generate a realistic performance report for campaign "${args.campaignId}".Metrics: Impressions, Clicks, CTR, ROI.Return as JSON.`;
            try {
                const response = await firebaseAI.generateStructuredData(prompt, { type: 'object' } as any);
                return { success: true, data: response };
            } catch (e) {
                return { success: false, error: (e as Error).message };
            }
        },
        generate_campaign_from_audio: async (args: { uploadedAudioIndex: number }) => {
            const { useStore } = await import('@/core/store');
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
                        insight: `Analyzed track.Genre: ${genre.join(', ')}.Mood: ${mood.join(', ')}.`,
                        suggested_one_liner: marketingHooks.oneLiner,
                        keywords: marketingHooks.keywords,
                        technical: profile.technical
                    }
                };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        },
        create_artifact_drop: SovereignTools.create_artifact_drop
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
                description: "Creates a 'Sovereign Artifact Drop' - a high-value purchase link for creative assets. Packages artwork, audio, and a generated license into a single commercial artifact.",
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
