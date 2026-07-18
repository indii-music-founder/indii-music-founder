import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';

export const draftCwrRegistration: IndiiMcpTool = {
    name: 'draft_cwr_registration',
    description: 'Generates Common Works Registration (CWR) files for PROs (ASCAP/BMI).',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string' },
            writers: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        ipi: { type: 'string' }
                    }
                }
            }
        },
        required: ['releaseId', 'writers']
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
            tool: 'draft_cwr_registration',
            args: rawArgs,
            initiatorUid: uid,
            createdAt: (await import('firebase-admin')).firestore.FieldValue.serverTimestamp()
        });
        return {
            content: [{ type: 'text', text: `Successfully executed draft_cwr_registration. Job ID: ${docRef.id}` }]
        };
    }
};
