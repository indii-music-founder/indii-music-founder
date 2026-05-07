import { AgentCard } from '../AgentCard.schema';

export const SocialCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'social',
    displayName: 'Social Agent',
    description: 'Specialist for social operations.',
    capabilities: [
    {
        "name": "create_social_calendar",
        "description": "Generate a multi-week content calendar for a music release.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "schedule_post_execution",
        "description": "Schedule a post for long-term execution on a specific platform.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_social_post",
        "description": "Generate a social media post.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "analyze_trends",
        "description": "Analyze current trends for a topic.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "browser_tool",
        "description": "Browse social platforms to spot trends or engagement.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "indii_image_gen",
        "description": "Generate memes, quote cards, or social assets.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "credential_vault",
        "description": "Retrieve social media login credentials.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "draft_advanced_thread",
        "description": "Draft an advanced multi-part thread for a social platform.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "analyze_sentiment",
        "description": "Crawls recent comments/mentions across linked socials (X/IG) and provides a sentiment and trend report.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "multi_platform_autopost",
        "description": "Direct API integration tool to automatically queue and post a single video to multiple short-form platforms (TikTok, YouTube Shorts, IG Reels) natively.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "dispatch_community_webhook",
        "description": "Dispatches an automated announcement (with rich embeds) into an artist's Discord or Telegram community server via webhook.",
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
