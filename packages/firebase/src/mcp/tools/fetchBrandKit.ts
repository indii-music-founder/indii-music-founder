import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';

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
        handler: async (rawArgs: Record<string, unknown>, context: McpContext) => {
        const targetUserId = (rawArgs as any).userId || (rawArgs as any).artistId || (rawArgs as any).ownerId || context.user.uid;
        try {
            verifyOwnership(context, targetUserId);
        } catch (e: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: e.message }]
            };
        }
        const uid = context.user.uid;
        return {
            content: [{ 
                type: 'text', 
                text: JSON.stringify({
                    artistId: targetUserId,
                    colors: { primary: '#FF5733', secondary: '#C70039' },
                    typography: { heading: 'Inter', body: 'Roboto' },
                    tone: 'Energetic and bold'
                }, null, 2) 
            }]
        };
    }
};
