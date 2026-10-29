import * as admin from 'firebase-admin';
import { failedOperationResult, operationResult, requireString, toolResponse, verifyReleaseOwnership, OwnershipFirestore } from '../helpers.js';
import { IndiiMcpTool, McpContext, McpToolResponse } from '../types.js';

import { clearanceTrackOwnerAllowed, parseClearanceTrackId, summarizeSampleDeclarations } from './sampleClearancePolicy.js';

const TOOL_NAME = 'audit_sample_clearance';

/**
 * P7a interim implementation (ISSUE-1100).
 *
 * Checks track's declared samples/interpolations metadata against clearanceStatus field.
 * Returns honest verdict: DECLARED-BUT-UNVERIFIED vs NONE-DECLARED.
 * Never claims fingerprint match. Stays fail-closed if no metadata fields exist.
 * Full P7b vendor integration (ACRCloud/Pex) is credential-gated.
 */
export const auditSampleClearance: IndiiMcpTool = {
    name: TOOL_NAME,
    description: 'Checks track metadata for declared samples/interpolations. P7a interim: reports clearance status from metadata fields only. P7b (vendor fingerprinting) is pending.',
    inputSchema: {
        type: 'object',
        properties: {
            trackId: { type: 'string', description: 'Track identifier' },
            releaseId: { type: 'string', description: 'Optional release id for ownership verification' }
        },
        required: ['trackId']
    },
    handler: async (rawArgs: Record<string, unknown>, context: McpContext): Promise<McpToolResponse> => {
        const actorUid = context.user.uid;

        let trackId: string;
        try {
            trackId = parseClearanceTrackId(rawArgs.trackId);
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

        try {
            const db = admin.firestore();
            
            // Optional ownership verification if releaseId supplied
            if (rawArgs.releaseId !== undefined) {
                const releaseId = requireString(rawArgs, 'releaseId');
                await verifyReleaseOwnership(db as unknown as OwnershipFirestore, actorUid, releaseId);
            }

            // A release grant never authorizes an unrelated track. Resolve the
            // caller's canonical library first, then the owner-checked legacy store.
            const scoped = await db.collection('users').doc(actorUid).collection('tracks').doc(trackId).get();
            let trackData: Record<string, unknown>;
            if (scoped.exists) {
                trackData = scoped.data() ?? {};
                if (!clearanceTrackOwnerAllowed('user', actorUid, trackData.userId)) {
                    throw new Error('Forbidden: track not found or not owned by caller');
                }
            } else {
                const legacy = await db.collection('tracks').doc(trackId).get();
                const legacyData = legacy.data() ?? {};
                if (!legacy.exists || !clearanceTrackOwnerAllowed('legacy', actorUid, legacyData.userId)) {
                    throw new Error('Forbidden: track not found or not owned by caller');
                }
                trackData = legacyData;
            }

            const summary = summarizeSampleDeclarations(
                trackData.samples, trackData.interpolations, trackData.clearanceStatus,
            );

            return toolResponse(operationResult({
                tool: TOOL_NAME,
                actorUid,
                status: 'succeeded',
                resourceType: 'track',
                resourceId: trackId,
                warnings: summary.warnings,
                data: summary.data,
            }));
        } catch (error) {
            return toolResponse(failedOperationResult({
                tool: TOOL_NAME,
                actorUid,
                resourceType: 'track',
                resourceId: trackId,
                code: error instanceof TypeError ? 'INVALID_ARGUMENT'
                    : error instanceof Error && error.message.startsWith('Forbidden:') ? 'PERMISSION_DENIED'
                    : 'AUDIT_FAILED',
                message: error instanceof Error ? error.message : 'Sample clearance audit failed.',
                retryable: false,
            }));
        }
    }
};
