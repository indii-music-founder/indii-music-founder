import { IndiiMcpTool } from '../types.js';

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
    handler: async (args: any) => {
        // STUB: Will update Firestore and generate PDF
        return {
            content: [{ type: 'text', text: `Split sheet registered for track ${args.trackId} with ${args.collaborators.length} collaborators.` }]
        };
    }
};
