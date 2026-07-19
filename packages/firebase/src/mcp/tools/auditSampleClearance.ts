import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';

export const auditSampleClearance: IndiiMcpTool = {
    name: 'audit_sample_clearance',
    description: 'Checks for flagged copyrighted material in a track.',
    inputSchema: {
        type: 'object',
        properties: {
            trackId: { type: 'string' }
        },
        required: ['trackId']
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
            tool: 'audit_sample_clearance',
            args: rawArgs,
            initiatorUid: uid,
            createdAt: (await import('firebase-admin')).firestore.FieldValue.serverTimestamp()
        });
        return {
            content: [{ type: 'text', text: `Successfully executed audit_sample_clearance. Job ID: ${docRef.id}` }]
        };
    }
};
