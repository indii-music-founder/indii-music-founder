import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';

export const registerSplitSheet: IndiiMcpTool = {
    name: 'register_split_sheet',
    description: 'Officially locks royalty splits and generates a contract.',
    inputSchema: {
        type: 'object',
        properties: {
            trackId: { type: 'string' },
            collaborators: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        percentage: { type: 'number' }
                    }
                }
            }
        },
        required: ['trackId', 'collaborators']
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
            tool: 'register_split_sheet',
            args: rawArgs,
            initiatorUid: uid,
            createdAt: (await import('firebase-admin')).firestore.FieldValue.serverTimestamp()
        });
        return {
            content: [{ type: 'text', text: `Successfully executed register_split_sheet. Job ID: ${docRef.id}` }]
        };
    }
};
