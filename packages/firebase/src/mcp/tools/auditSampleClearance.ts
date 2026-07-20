import { failedOperationResult, requireString, toolResponse } from '../helpers.js';
import { IndiiMcpTool, McpContext, McpToolResponse } from '../types.js';

const TOOL_NAME = 'audit_sample_clearance';

/**
 * FAIL-CLOSED STUB (ISSUE-1098).
 *
 * No sample-lineage / sample-clearance analysis backend exists anywhere in the
 * repo. This tool therefore performs NO work and returns an honest failure:
 * no Firestore write, no queued job, no fabricated result. The previous
 * implementation wrote a decorative `mcpJobs` document (persisting raw args)
 * and derived its authorization target from model-supplied args — both removed.
 */
export const auditSampleClearance: IndiiMcpTool = {
    name: TOOL_NAME,
    description: 'Checks for flagged copyrighted material in a track. Currently unavailable: no sample-clearance analysis backend exists yet, so this tool always fails closed.',
    inputSchema: {
        type: 'object',
        properties: {
            trackId: { type: 'string' }
        },
        required: ['trackId']
    },
    handler: async (rawArgs: Record<string, unknown>, context: McpContext): Promise<McpToolResponse> => {
        const actorUid = context.user.uid;

        let trackId: string;
        try {
            trackId = requireString(rawArgs, 'trackId');
        } catch (error: unknown) {
            return toolResponse(failedOperationResult({
                tool: TOOL_NAME,
                actorUid,
                resourceType: 'track',
                resourceId: 'invalid',
                code: 'INVALID_ARGUMENT',
                message: error instanceof Error ? error.message : String(error),
                retryable: false,
            }));
        }

        return toolResponse(failedOperationResult({
            tool: TOOL_NAME,
            actorUid,
            resourceType: 'track',
            resourceId: trackId,
            code: 'BACKEND_UNAVAILABLE',
            message: 'No sample-clearance analysis backend exists yet; no audit was performed and no job was queued.',
            retryable: false,
        }));
    }
};
