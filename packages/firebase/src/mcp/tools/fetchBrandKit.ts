import { IndiiMcpTool } from '../types.js';

export const fetchBrandKit: IndiiMcpTool = {
    name: 'fetch_brand_kit',
    description: 'Pulls the artist brand aesthetic data (colors, typography, tone).',
    inputSchema: {
        type: 'object',
        properties: {
            artistId: { type: 'string' }
        },
        required: ['artistId']
    },
    handler: async () => {
        // Fail closed until the Firestore brand-kit read ships (ISSUE-1089).
        // Never return a fabricated brand kit as if it were the artist's real data.
        return {
            isError: true,
            content: [{ type: 'text', text: 'fetch_brand_kit is not implemented yet. No brand kit data was retrieved. This tool requires the Firestore brand-kit backend scoped to the authenticated caller. Do not invent brand colors, typography, or tone.' }]
        };
    }
};
