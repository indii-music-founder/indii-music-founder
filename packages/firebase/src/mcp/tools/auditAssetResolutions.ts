import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';

export const auditAssetResolutions: IndiiMcpTool = {
    name: 'audit_asset_resolutions',
    description: 'Verifies if distributed assets meet DSP requirements (e.g. 3000x3000px cover art).',
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
        const db = (await import('firebase-admin')).firestore();
        const docRef = await db.collection('mcpJobs').add({
            tool: 'audit_asset_resolutions',
            args: rawArgs,
            initiatorUid: uid,
            createdAt: (await import('firebase-admin')).firestore.FieldValue.serverTimestamp()
        });
        return {
            content: [{ type: 'text', text: `Successfully executed audit_asset_resolutions. Job ID: ${docRef.id}` }]
        };
    }
};
