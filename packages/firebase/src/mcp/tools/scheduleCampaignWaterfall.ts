import { IndiiMcpTool } from '../types.js';

export const scheduleCampaignWaterfall: IndiiMcpTool = {
    name: 'schedule_campaign_waterfall',
    description: 'Injects a timeline of promotional events into the background job runner (Inngest).',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string' },
            campaignStartDate: { type: 'string' },
            budget: { type: 'number' }
        },
        required: ['releaseId', 'campaignStartDate']
    },
    handler: async (args: any) => {
        // STUB: Will trigger Inngest jobs
        return {
            content: [{ type: 'text', text: `Campaign waterfall scheduled for release ${args.releaseId} starting on ${args.campaignStartDate}.` }]
        };
    }
};
