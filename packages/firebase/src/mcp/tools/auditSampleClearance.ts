import { IndiiMcpTool } from '../types.js';

export const auditSampleClearance: IndiiMcpTool = {
    name: 'audit_sample_clearance',
    description: 'Checks for flagged copyrighted material in a track.',
    inputSchema: {
        type: 'object',
        properties: {
            trackId: { type: 'string' }
        },
        required: ['trackId']
    },
    handler: async () => {
        // Fail closed until the Audio Intelligence / YAMNet query ships (ISSUE-1089).
        // A fabricated clearance verdict is a legal-exposure hazard for the artist.
        return {
            isError: true,
            content: [{ type: 'text', text: 'audit_sample_clearance is not implemented yet. No audio analysis was performed and no clearance verdict exists. This tool requires the Audio Intelligence backend. Never state that a track is clear of uncleared samples.' }]
        };
    }
};
