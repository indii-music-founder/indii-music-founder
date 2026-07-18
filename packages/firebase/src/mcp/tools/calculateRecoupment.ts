import { IndiiMcpTool } from '../types.js';

export const calculateRecoupment: IndiiMcpTool = {
    name: 'calculate_recoupment',
    description: 'Calculates if an artist has recouped their marketing spend.',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string' }
        },
        required: ['releaseId']
    },
    handler: async () => {
        // Fail closed until Firestore spend + BigQuery revenue queries ship (ISSUE-1089).
        // Fabricated financial figures must never reach an artist.
        return {
            isError: true,
            content: [{ type: 'text', text: 'calculate_recoupment is not implemented yet. No spend or revenue data was queried and no recoupment status exists. This tool requires the Firestore spend + BigQuery revenue backend. Do not invent financial figures.' }]
        };
    }
};
