import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';

export const generatePlaylistPitch: IndiiMcpTool = {
    name: 'generate_playlist_pitch',
    description: 'Generates highly targeted pitch emails for Spotify Editorial curators based on audio analysis.',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string', description: 'The ID of the release in Firestore' },
            targetPlaylist: { type: 'string', description: 'Name of the playlist (e.g., RapCaviar)' },
            curatorName: { type: 'string', description: 'Optional curator name' }
        },
        required: ['releaseId', 'targetPlaylist']
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
            tool: 'generate_playlist_pitch',
            args: rawArgs,
            initiatorUid: uid,
            createdAt: (await import('firebase-admin')).firestore.FieldValue.serverTimestamp()
        });
        return {
            content: [{ type: 'text', text: `Successfully executed generate_playlist_pitch. Job ID: ${docRef.id}` }]
        };
    }
};
