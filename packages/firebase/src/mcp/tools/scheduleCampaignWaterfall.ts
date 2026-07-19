import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';

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
        const db = (await import('firebase-admin')).firestore();
        const docRef = await db.collection('mcpJobs').add({
            tool: 'schedule_campaign_waterfall',
            args: rawArgs,
            initiatorUid: uid,
            createdAt: (await import('firebase-admin')).firestore.FieldValue.serverTimestamp()
        });
        return {
            content: [{ type: 'text', text: `Successfully executed schedule_campaign_waterfall. Job ID: ${docRef.id}` }]
        };
    }
};
