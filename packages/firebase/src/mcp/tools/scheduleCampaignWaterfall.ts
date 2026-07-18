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
    handler: async () => {
        // Fail closed until the Inngest job dispatch ships (ISSUE-1089).
        return {
            isError: true,
            content: [{ type: 'text', text: 'schedule_campaign_waterfall is not implemented yet. No campaign events were scheduled and no Inngest jobs exist. This tool requires the Inngest campaign backend. Do not report a campaign as scheduled.' }]
        };
    }
};
