import { IndiiMcpTool } from '../types.js';

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
    handler: async () => {
        // Fail closed until the CWR formatting backend ships (ISSUE-1089).
        // A PRO registration file must come from real work metadata, never a placeholder.
        return {
            isError: true,
            content: [{ type: 'text', text: 'draft_cwr_registration is not implemented yet. No CWR file was drafted. This tool requires the CWR formatting backend fed by real work metadata. Do not report a CWR file as drafted.' }]
        };
    }
};
