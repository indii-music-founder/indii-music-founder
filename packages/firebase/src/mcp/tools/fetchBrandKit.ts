import { IndiiMcpTool } from '../types.js';

export const fetchBrandKit: IndiiMcpTool = {
    name: 'fetch_brand_kit',
    description: 'Pulls the artist brand aesthetic data (colors, typography, tone).',
    inputSchema: {
        type: 'object',
        properties: {
            artistId: { type: 'string' }
        },
        required: ['artistId']
    },
    handler: async (args: any) => {
        // STUB: Will pull from Firestore
        const mockBrandKit = {
            primaryColor: '#FF0055',
            secondaryColor: '#000000',
            typography: 'Inter',
            tone: 'Rebellious and energetic'
        };
        return {
            content: [{ type: 'text', text: JSON.stringify(mockBrandKit, null, 2) }]
        };
    }
};
