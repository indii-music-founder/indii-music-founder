import { AgentConfig } from "../types";
import { AutonomousTools } from '../tools/AutonomousTools';
import { MarketingTools } from '../tools/MarketingTools';
import { UniversalTools } from '../tools/UniversalTools';
import systemPrompt from '@agents/marketing/prompt.md?raw';


const marketingRetrievalConfig = {
    'campaigns': { path: 'campaigns', requiresUserIdFilter: true },
    'scheduledPosts': { path: 'scheduledPosts', requiresUserIdFilter: true },
    'bountyLinks': { path: 'bountyLinks', requiresUserIdFilter: true },
    'influencerBounties': { path: 'influencerBounties', requiresUserIdFilter: true }
};
const marketingRetrievalTools = buildDomainRetrievalTools('Marketing', marketingRetrievalConfig);
const marketingRetrievalDeclarations = buildDomainRetrievalDeclarations('Marketing', marketingRetrievalConfig);

export const MarketingAgent: AgentConfig = {
    id: 'marketing',
    name: 'Marketing Director',
    description: 'Orchestrates multi-channel marketing campaigns, strategy, and content calendars.',
    color: 'bg-orange-500',
    category: 'department',
    systemPrompt: systemPrompt,
    get functions() {
        return {
            ...marketingRetrievalTools,
            create_campaign_brief: MarketingTools.create_campaign_brief,
            analyze_audience: MarketingTools.analyze_audience,
            schedule_content: MarketingTools.schedule_content,
            track_performance: MarketingTools.track_performance,
            generate_campaign_from_audio: MarketingTools.generate_campaign_from_audio,
            web_extract: UniversalTools.web_extract,
            indii_image_gen: UniversalTools.indii_image_gen,
            create_artifact_drop: AutonomousTools.create_artifact_drop,
            generate_ab_campaign: MarketingTools.generate_ab_campaign,
            deploy_micro_ad_campaign: MarketingTools.deploy_micro_ad_campaign,
            deploy_email_newsletter: MarketingTools.deploy_email_newsletter,
            generate_presave_campaign: MarketingTools.generate_presave_campaign,
            deploy_sms_blast: MarketingTools.deploy_sms_blast,
            enrich_fan_data: MarketingTools.enrich_fan_data,
            generate_influencer_bounty: MarketingTools.generate_influencer_bounty,
            generate_ad_copy: MarketingTools.generate_ad_copy,
            analyze_campaign_roi: MarketingTools.analyze_campaign_roi,
            dispatch_multi_platform_campaign: MarketingTools.dispatch_multi_platform_campaign,
            record_attribution_conversion: MarketingTools.record_attribution_conversion,
        } as Record<string, import('@/services/agent/types').AnyToolFunction>;
    },
    authorizedTools: ['list_domain_records', 'create_campaign_brief', 'analyze_audience', 'schedule_content', 'track_performance', 'generate_campaign_from_audio', 'web_extract', 'indii_image_gen', 'create_artifact_drop', 'generate_ab_campaign', 'deploy_micro_ad_campaign', 'deploy_email_newsletter', 'generate_presave_campaign', 'deploy_sms_blast', 'enrich_fan_data', 'generate_influencer_bounty', 'generate_ad_copy', 'analyze_campaign_roi', 'dispatch_multi_platform_campaign', 'record_attribution_conversion'],
    tools: [{
        functionDeclarations: [
            ...marketingRetrievalDeclarations,
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
                description: 'Generate a draft content posting plan with real dates. This does not persist or queue anything for delivery — it is a plan the user must still act on.',
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
                name: "web_extract",
                description: "Read bounded text from a public web page. This tool cannot log in, click, type, or submit forms.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        url: { type: "STRING", description: "Public HTTP(S) URL to read." }
                    },
                    required: ["url"]
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
                description: "Saves an unverified artifact-drop draft for review. Does not publish a purchase link, accept a license, configure inventory, collect payment, or arrange fulfillment.",
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
                description: "Prepares a micro-budget (10 dollars per day) ad campaign package for review (live deployment requires provider credentials).",
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
                description: "Prepares a custom HTML newsletter template for deployment (requires connected email provider).",
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
                description: "Prepares SMS message content for delivery to a segmented superfan list (requires connected Twilio account for live sending).",
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
            },
            {
                name: "generate_ad_copy",
                description: "Generates tailored ad copy for a product targeting a specific audience on a given platform.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        productName: { type: "STRING", description: "The product or release to market." },
                        targetAudience: { type: "STRING", description: "The intended demographic." },
                        tone: { type: "STRING", description: "The tone of the copy (e.g., engaging, professional, hype)." },
                        platform: { type: "STRING", description: "The platform for the ad (e.g., Instagram, Twitter)." }
                    },
                    required: ["productName", "targetAudience", "platform"]
                }
            },
            {
                name: "analyze_campaign_roi",
                description: "Analyzes the Return on Investment (ROI) for a specific campaign.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        campaignId: { type: "STRING", description: "The ID of the campaign to track." },
                        totalSpend: { type: "NUMBER", description: "Total amount spent on the campaign." },
                        totalRevenue: { type: "NUMBER", description: "Total revenue generated from the campaign." }
                    },
                    required: ["campaignId", "totalSpend", "totalRevenue"]
                }
            },
            {
                name: "dispatch_multi_platform_campaign",
                description: "Executes a verified post-mastering multi-platform programmatic ad directive across Meta, TikTok (Spark Ads), and Google Ads (YouTube Video Action / PMax) with Finance recoupment ledger reservation and Jev allocation refinement.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        ledgerAccountId: { type: "STRING", description: "Finance recoupment ledger account ID." },
                        objective: {
                            type: "STRING",
                            enum: ["DSP_STREAM_CONVERSION", "PRE_SAVE_INTAKE", "WAITLIST_INTAKE", "MERCH_CONVERSION", "EVENT_TICKETING"],
                            description: "Primary campaign objective."
                        },
                        platforms: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "Target ad networks: META, TIKTOK, GOOGLE_ADS."
                        },
                        totalBudgetCents: { type: "NUMBER", description: "Total campaign budget in integer cents." },
                        dailyBudgetCents: { type: "NUMBER", description: "Daily campaign budget in integer cents." },
                        platformSplitPercentages: {
                            type: "OBJECT",
                            description: "Platform percentage splits summing to 100 (e.g., { META: 50, TIKTOK: 30, GOOGLE_ADS: 20 })."
                        },
                        releaseId: { type: "STRING", description: "Verified post-mastering release ID." },
                        isrc: { type: "STRING", description: "12-character uppercase ISRC." },
                        smartlinkId: { type: "STRING", description: "Verified smartlink ID." },
                        smartlinkUrl: { type: "STRING", description: "Verified HTTPS smartlink destination URL." },
                        videoAssetIds: { type: "ARRAY", items: { type: "STRING" }, description: "Verified video teaser asset IDs." },
                        imageAssetIds: { type: "ARRAY", items: { type: "STRING" }, description: "Verified cover/artwork asset IDs." },
                        tiktokSparkAuthCodes: { type: "ARRAY", items: { type: "STRING" }, description: "Optional TikTok Spark Ads auth codes." },
                        youtubeVideoIds: { type: "ARRAY", items: { type: "STRING" }, description: "Optional 11-char YouTube video IDs for Google Ads." },
                        geoLocations: { type: "ARRAY", items: { type: "STRING" }, description: "ISO country/region codes (e.g., ['US', 'GB'])." },
                        genreTaxonomyTags: { type: "ARRAY", items: { type: "STRING" }, description: "Genre taxonomy tags." }
                    },
                    required: [
                        "ledgerAccountId",
                        "objective",
                        "platforms",
                        "totalBudgetCents",
                        "dailyBudgetCents",
                        "platformSplitPercentages",
                        "releaseId",
                        "isrc",
                        "smartlinkId",
                        "smartlinkUrl",
                        "videoAssetIds",
                        "imageAssetIds",
                        "geoLocations",
                        "genreTaxonomyTags"
                    ]
                }
            },
            {
                name: "record_attribution_conversion",
                description: "Dispatches a deduplicated server-side conversion event (SmartlinkView, DSPOutboundClick, PreSaveComplete, WaitlistSignup, MerchPurchase) through AttributionBus to Meta CAPI, TikTok Events API, and Google Ads Enhanced Conversions.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        eventName: {
                            type: "STRING",
                            enum: ["SmartlinkView", "DSPOutboundClick", "PreSaveComplete", "WaitlistSignup", "MerchPurchase"],
                            description: "Normalized conversion event name."
                        },
                        releaseId: { type: "STRING", description: "Verified release ID." },
                        isrc: { type: "STRING", description: "12-character ISRC." },
                        smartlinkId: { type: "STRING", description: "Smartlink identifier." },
                        targetDsp: {
                            type: "STRING",
                            enum: ["SPOTIFY", "APPLE_MUSIC", "TIDAL", "AMAZON_MUSIC", "YOUTUBE_MUSIC", "BANDCAMP"],
                            description: "Optional destination DSP for outbound clicks."
                        },
                        fbclid: { type: "STRING", description: "Optional Meta click identifier." },
                        ttclid: { type: "STRING", description: "Optional TikTok click identifier." },
                        gclid: { type: "STRING", description: "Optional Google Ads click identifier." },
                        clientIpAddress: { type: "STRING", description: "Client IP address for CAPI matching." },
                        clientUserAgent: { type: "STRING", description: "Client User-Agent string." },
                        emailSha256: { type: "STRING", description: "Optional 64-char lowercase hex SHA-256 of fan email." },
                        valueCents: { type: "NUMBER", description: "Optional conversion value in integer cents." }
                    },
                    required: ["eventName", "releaseId", "isrc", "smartlinkId", "clientIpAddress", "clientUserAgent"]
                }
            }
        ]
    }]

};

import { freezeAgentConfig } from '../FreezeDiagnostic';
import { buildDomainRetrievalTools, buildDomainRetrievalDeclarations } from '../tools/DomainTools';


// Freeze the schema to prevent cross-test contamination
freezeAgentConfig(MarketingAgent);
