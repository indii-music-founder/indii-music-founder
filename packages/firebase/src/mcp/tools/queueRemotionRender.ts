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
    handler: async () => {
        // Fail closed until the Remotion / Cloud Run dispatch ships (ISSUE-1089).
        return {
            isError: true,
            content: [{ type: 'text', text: 'queue_remotion_render is not implemented yet. No render was queued. This tool requires the Remotion render dispatch backend. Do not report a render as queued.' }]
        };
    }
};
