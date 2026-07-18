import { IndiiMcpTool } from '../types.js';

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
    handler: async (args: any) => {
        // STUB: Will dispatch to Remotion / Cloud Run
        return {
            content: [{ type: 'text', text: `Successfully queued ${args.canvasType} render for release ${args.releaseId}.` }]
        };
    }
};
