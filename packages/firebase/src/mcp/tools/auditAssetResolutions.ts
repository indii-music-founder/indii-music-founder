import { IndiiMcpTool } from '../types.js';

export const auditAssetResolutions: IndiiMcpTool = {
    name: 'audit_asset_resolutions',
    description: 'Verifies if distributed assets meet DSP requirements (e.g. 3000x3000px cover art).',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string' }
        },
        required: ['releaseId']
    },
    handler: async () => {
        // Fail closed until the Storage metadata audit ships (ISSUE-1089).
        // A fabricated compliance pass could send a release to DSP rejection.
        return {
            isError: true,
            content: [{ type: 'text', text: 'audit_asset_resolutions is not implemented yet. No assets were inspected and no compliance verdict exists. This tool requires the Firebase Storage metadata audit backend. Do not report assets as meeting DSP requirements.' }]
        };
    }
};
