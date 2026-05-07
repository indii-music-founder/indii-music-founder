import { AgentCard } from '../AgentCard.schema';

export const MarketingCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'marketing',
    displayName: 'Marketing Agent',
    description: 'Specialist for marketing operations.',
    capabilities: [
    {
        "name": "create_campaign_brief",
        "description": "Generate a structured campaign brief including target audience, budget, and channels.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "analyze_audience",
        "description": "Analyze demographics and interests for a specific platform.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "schedule_content",
        "description": "Schedule a batch of content posts.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "track_performance",
        "description": "Get performance metrics for a specific campaign.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_campaign_from_audio",
        "description": "Analyze an audio track to generate marketing insights and campaign hooks.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "browser_tool",
        "description": "Research market trends, competitor ads, or platform algorithms.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "indii_image_gen",
        "description": "Generate ad creative, moodboards, or mockups.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "create_artifact_drop",
        "description": "Creates a 'Sovereign Artifact Drop' - a high-value purchase link for creative assets. Packages artwork, audio, and a generated license into a single commercial artifact.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_ab_campaign",
        "description": "Generates 3 variants of ad copy for A/B testing and outputs a tracking pixel snippet for campaign analytics.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "deploy_micro_ad_campaign",
        "description": "Deploys a micro-budget ($10/day) ad campaign across Meta or TikTok Graph APIs, utilizing A/B tested creatives.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "deploy_email_newsletter",
        "description": "Syncs with Mailchimp/Klaviyo APIs to deploy a custom HTML newsletter template to a specific audience segment.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_presave_campaign",
        "description": "Generates a responsive pre-save landing page designed to collect fan emails/phone numbers before release.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "deploy_sms_blast",
        "description": "Hooks into Twilio APIs to send direct SMS blasts to a segmented superfan list for surprise drops or pre-saves.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "enrich_fan_data",
        "description": "Uses external APIs (like Clearbit/Apollo) to enrich a raw fan email address with demographic insights and social links.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_influencer_bounty",
        "description": "Creates a tracked referral link campaign for micro-influencers to use the artist's sound on TikTok/Reels.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    }
],
    inputSchemas: {},
    outputSchemas: {},
    costModel: {
        perTokenInUsd: 0,
        perTokenOutUsd: 0
    },
    riskTier: 'write',
    sla: {
        modeSync: {
            p50Ms: 2000,
            p99Ms: 5000
        },
        modeStream: {
            firstByteMs: 500
        }
    }
};
