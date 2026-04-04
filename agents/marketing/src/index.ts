/* eslint-disable @typescript-eslint/no-explicit-any -- Utility/config types use any by design */

import { Agent, createTool } from '@mastra/core';
import { MCPClient } from '@mastra/mcp';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { MarketingTools } from '@/services/agent/tools/MarketingTools';
import { DirectorTools } from '@/services/agent/tools/DirectorTools';
import { SovereignTools } from '@/services/agent/tools/SovereignTools';
import { BrowserTools } from '@/services/agent/tools/BrowserTools';

// --- Create Mastra-compatible tools that wrap the working Tools ---

const createCampaignBriefTool = createTool({
    id: 'create_campaign_brief',
    description: 'Generate a structured campaign brief including target audience, budget, and channels.',
    inputSchema: z.object({
        product: z.string().describe('The product or release to market.'),
        goal: z.string().describe('The primary goal of the campaign (e.g., "1M streams").'),
        budget: z.string().optional().describe('Budget allocation'),
        duration: z.string().optional().describe('Duration of campaign'),
        assetIds: z.array(z.string()).optional().describe('Attached asset IDs')
    }),
    execute: async ({ context }) => {
        try {
            const result = await MarketingTools.create_campaign_brief(context);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] Campaign brief generation failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const analyzeAudienceTool = createTool({
    id: 'analyze_audience',
    description: 'Analyze demographics and interests for a specific platform.',
    inputSchema: z.object({
        genre: z.string().describe('The genre to analyze.'),
        similar_artists: z.array(z.string()).optional().describe('List of similar artists')
    }),
    execute: async ({ context }) => {
        try {
            const result = await MarketingTools.analyze_audience(context);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] Audience analysis failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const scheduleContentTool = createTool({
    id: 'schedule_content',
    description: 'Schedule a batch of content posts across platforms.',
    inputSchema: z.object({
        campaign_start: z.string().describe('ISO string start date of the campaign.'),
        platforms: z.array(z.string()).describe('List of platforms.'),
        frequency: z.string().describe('Frequency string e.g. "daily", "bi-weekly"')
    }),
    execute: async ({ context }) => {
        try {
            const result = await MarketingTools.schedule_content(context);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] Schedule content failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const trackPerformanceTool = createTool({
    id: 'track_performance',
    description: 'Get performance metrics for a specific campaign.',
    inputSchema: z.object({
        campaignId: z.string().describe('The ID of the campaign to track.')
    }),
    execute: async ({ context }) => {
        try {
            const result = await MarketingTools.track_performance(context);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] Track performance failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const generateCampaignFromAudioTool = createTool({
    id: 'generate_campaign_from_audio',
    description: 'Analyze an audio track to generate marketing insights and campaign hooks.',
    inputSchema: z.object({
        uploadedAudioIndex: z.number().describe('Index of audio file in uploads (default 0).')
    }),
    execute: async ({ context }) => {
        try {
            const result = await MarketingTools.generate_campaign_from_audio(context);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] Campaign from audio failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const analyzeMarketTrendsTool = createTool({
    id: 'analyze_market_trends',
    description: 'Research market trends and competitor info over IPC bridge.',
    inputSchema: z.object({
        category: z.string().optional().describe('Category to analyze.')
    }),
    execute: async ({ context }) => {
        try {
            const result = await MarketingTools.analyze_market_trends(context);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] Analyze market trends failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const createABTestCampaignTool = createTool({
    id: 'create_ab_test_campaign',
    description: 'Generates 3 variants of ad copy for A/B testing and tracking pixel.',
    inputSchema: z.object({
        product: z.string().describe('The product or release.'),
        goal: z.string().describe('Campaign goal.'),
        channels: z.array(z.string()).describe('List of channels.')
    }),
    execute: async ({ context }) => {
        try {
            const result = await MarketingTools.create_ab_test_campaign(context);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] Create A/B test campaign failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const tierSuperfansTool = createTool({
    id: 'tier_superfans',
    description: 'Categorize fans into tiers using spent amounts.',
    inputSchema: z.object({
        minSpendForVIP: z.number().describe('Minimum spend threshold for VIP tier.'),
        minSpendForSuperfan: z.number().describe('Minimum spend threshold for Superfan tier.')
    }),
    execute: async ({ context }) => {
        try {
            const result = await MarketingTools.tier_superfans(context);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] Tier superfans failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const trackPostReleaseMomentumTool = createTool({
    id: 'track_post_release_momentum',
    description: 'Track post-release momentum and score ROI.',
    inputSchema: z.object({
        trackId: z.string().describe('ID of the track.'),
        adSpend: z.number().describe('Amount of ad spend.'),
        organicStreams: z.number().describe('Count of organic streams.'),
        dsp: z.string().describe('DSP platform Name.')
    }),
    execute: async ({ context }) => {
        try {
            const result = await MarketingTools.track_post_release_momentum(context);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] Track momentum failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const indiiImageGenTool = createTool({
    id: 'indii_image_gen',
    description: 'Generate ad creative, moodboards, or mockups. Delegates to Director.',
    inputSchema: z.object({
        prompt: z.string().describe('Visual description of the image to generate'),
        aspectRatio: z.string().optional().describe('Aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2')
    }),
    execute: async ({ context }) => {
        try {
            // Calls the Director tool explicitly through the bridge
            const result = await DirectorTools.generate_image(context);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] indii_image_gen failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const createArtifactDropTool = createTool({
    id: 'create_artifact_drop',
    description: 'Creates a Sovereign Artifact Drop with high-value assets and licensing.',
    inputSchema: z.object({
        title: z.string().describe('Title of the artifact.'),
        description: z.string().describe('Marketing description for the drop.'),
        priceUsd: z.number().describe('Price in USD.'),
        artworkUrl: z.string().describe('Public URL of the artwork.'),
        audioUrl: z.string().optional().describe('Optional public URL of the audio track.'),
        licenseType: z.enum(['Personal', 'Commercial', 'Exclusive']).describe('License type')
    }),
    execute: async ({ context }) => {
        try {
            const result = await SovereignTools.create_artifact_drop(context as any);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] create_artifact_drop failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const browserActionTool = createTool({
    id: 'browser_tool',
    description: 'Research market trends or platform algorithms via browser.',
    inputSchema: z.object({
        action: z.string().describe('Action: open, click, type, get_dom'),
        url: z.string().optional().describe('URL to navigate to.'),
        selector: z.string().optional().describe('CSS selector for interaction.'),
        text: z.string().optional().describe('Text to type')
    }),
    execute: async ({ context }) => {
        try {
            const result = await BrowserTools.browser_tool(context as any);
            return { success: result.success, data: result.data, message: result.message };
        } catch (error: any) {
            console.error('[Mastra Agent] browser_tool failed:', error);
            return { success: false, error: error.message };
        }
    }
});

const mcpClient = new MCPClient({
    id: 'docker-gateway-client',
    servers: {
        dockerGateway: {
            url: new URL(process.env.MCP_DOCKER_GATEWAY_URL || 'http://localhost:8080'),
        },
    },
});

export const marketingAgent = new Agent({
    name: 'Marketing Department',
    instructions: `
    You are the Music Campaign Manager for indiiOS.
    You design and execute comprehensive release campaigns, DSP playlisting strategies,
    fan engagement funnels, and data-driven growth plans.
    
    RULES:
    1. Base your decisions on cost-per-save and concrete numbers.
    2. Suggest only allowed platforms, specifically focusing on Instagram Stories and TikTok.
    3. You can execute micro-budget ($10/day) marketing deployments directly.
    4. Focus on waterfall releases, single-to-album drops.
    
    TOOL PROTOCOLS:
    - Use create_campaign_brief for overall strategy.
    - analyze_audience provides demographic insight.
    - For creatives, delegate by calling indii_image_gen.
    - The browser_tool is useful to scope out competitors on Chartmetric.
    
    Tone: Industry-savvy, narrative-driven, sharp, concise.
  `,
    model: google('gemini-3.1-pro-preview'),
    tools: [
        createCampaignBriefTool,
        analyzeAudienceTool,
        scheduleContentTool,
        trackPerformanceTool,
        generateCampaignFromAudioTool,
        analyzeMarketTrendsTool,
        createABTestCampaignTool,
        tierSuperfansTool,
        trackPostReleaseMomentumTool,
        indiiImageGenTool,
        createArtifactDropTool,
        browserActionTool
    ],
    mcpClient: mcpClient,
});
