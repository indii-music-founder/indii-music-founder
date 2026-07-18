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
    handler: async () => {
        // Fail closed until the Firestore split registration + contract PDF backend ships (ISSUE-1089).
        // Royalty splits are legally binding — never claim they were registered.
        return {
            isError: true,
            content: [{ type: 'text', text: 'register_split_sheet is not implemented yet. No splits were locked, no record was written, and no contract was generated. This tool requires the split-sheet registration backend. Do not report splits as registered.' }]
        };
    }
};
