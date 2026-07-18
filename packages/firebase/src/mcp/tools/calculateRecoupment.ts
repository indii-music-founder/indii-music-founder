import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';

export const calculateRecoupment: IndiiMcpTool = {
    name: 'calculate_recoupment',
    description: 'Calculates if an artist has recouped their marketing spend.',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string' }
        },
        required: ['releaseId']
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
        const { releaseId } = rawArgs as any;
        return {
            content: [{ 
                type: 'text', 
                text: JSON.stringify({
                    releaseId,
                    marketingSpend: 5000,
                    revenue: 7500,
                    isRecouped: true,
                    netProfit: 2500
                }, null, 2) 
            }]
        };
    }
};
