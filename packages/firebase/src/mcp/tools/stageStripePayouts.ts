import { IndiiMcpTool } from '../types.js';

export const stageStripePayouts: IndiiMcpTool = {
    name: 'stage_stripe_payouts',
    description: 'Prepares royalty payouts for one-click approval.',
    inputSchema: {
        type: 'object',
        properties: {
            artistId: { type: 'string' },
            payoutPeriod: { type: 'string' }
        },
        required: ['artistId', 'payoutPeriod']
    },
    handler: async () => {
        // Fail closed until the Stripe Connect staging backend ships (ISSUE-1089).
        // A money-path tool must never fabricate success.
        return {
            isError: true,
            content: [{ type: 'text', text: 'stage_stripe_payouts is not implemented yet. No payouts were staged and no Stripe transfers exist. This tool requires the Stripe Connect staging backend with caller-scoped authorization. Do not report payouts as staged.' }]
        };
    }
};
