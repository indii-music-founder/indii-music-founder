import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';

export const queueRemotionRender: IndiiMcpTool = {
    name: 'queue_remotion_render',
    description: 'Sends a video specification to the rendering engine (Remotion).',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string' },
            canvasType: { type: 'string', enum: ['Spotify', 'TikTok', 'Instagram'] },
            animationSpec: { type: 'object' }
        },
        required: ['releaseId', 'canvasType']
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
        
        const { releaseId, canvasType, animationSpec } = rawArgs as any;
        
        const db = (await import('firebase-admin')).firestore();
        const docRef = await db.collection('videoJobs').add({
            type: 'video',
            status: 'queued',
            releaseId,
            canvasType,
            animationSpec: animationSpec || {},
            initiatorUid: uid,
            createdAt: (await import('firebase-admin')).firestore.FieldValue.serverTimestamp()
        });

        return {
            content: [{ type: 'text', text: `Successfully queued Remotion render job ${docRef.id} for release ${releaseId}. Canvas: ${canvasType}.` }]
        };
    }
};
