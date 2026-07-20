import * as admin from 'firebase-admin';
import { failedOperationResult, operationResult, requireString, toolResponse, verifyReleaseOwnership, OwnershipFirestore } from '../helpers.js';
import { IndiiMcpTool, McpContext, McpToolResponse } from '../types.js';

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

        try {
            const db = admin.firestore();
            
            // Optional ownership verification if releaseId supplied
            if (rawArgs.releaseId !== undefined) {
                const releaseId = requireString(rawArgs, 'releaseId');
                await verifyReleaseOwnership(db as unknown as OwnershipFirestore, actorUid, releaseId);
            }

            // Read track metadata
            const trackSnap = await db.collection('tracks').doc(trackId).get();
            if (!trackSnap.exists) {
                return toolResponse(failedOperationResult({
                    tool: TOOL_NAME,
                    actorUid,
                    resourceType: 'track',
                    resourceId: trackId,
                    code: 'NOT_FOUND',
                    message: `Track ${trackId} not found.`,
                    retryable: false,
                }));
            }

            const trackData = trackSnap.data() || {};
            const samples = trackData.samples || [];
            const interpolations = trackData.interpolations || [];
            const clearanceStatus = trackData.clearanceStatus || 'unverified';

            // Determine verdict: DECLARED-BUT-UNVERIFIED or NONE-DECLARED
            const hasSampleMetadata = Array.isArray(samples) && samples.length > 0;
            const hasInterpolationMetadata = Array.isArray(interpolations) && interpolations.length > 0;
            const samplesDeclarationCount = (hasSampleMetadata ? samples.length : 0) + (hasInterpolationMetadata ? interpolations.length : 0);

            let verdict = 'NONE-DECLARED';
            const warnings: string[] = [];

            if (samplesDeclarationCount > 0) {
                verdict = 'DECLARED-BUT-UNVERIFIED';
                warnings.push(`Track declares ${samplesDeclarationCount} sample(s)/interpolation(s) but clearanceStatus is '${clearanceStatus}' — no fingerprint verification has been performed.`);
                if (clearanceStatus === 'unverified') {
                    warnings.push('CRITICAL: Verify clearance with rights holders before commercial use. Declared samples have NOT been validated.');
                }
            } else {
                warnings.push('No samples or interpolations declared in track metadata.');
            }

            warnings.push('P7a interim: metadata-declaration check only. Full fingerprint analysis (P7b) pending vendor integration.');

            return toolResponse(operationResult({
                tool: TOOL_NAME,
                actorUid,
                status: 'succeeded',
                resourceType: 'track',
                resourceId: trackId,
                warnings,
                data: {
                    verdict,
                    samplesDeclarationCount,
                    hasSampleMetadata,
                    hasInterpolationMetadata,
                    clearanceStatus,
                    fingerprintAnalysisAvailable: false,
                    note: 'This is a metadata check only. Fingerprint analysis (P7b) requires vendor credentials.',
                },
            }));
        } catch (error) {
            return toolResponse(failedOperationResult({
                tool: TOOL_NAME,
                actorUid,
                resourceType: 'track',
                resourceId: trackId,
                code: 'AUDIT_FAILED',
                message: error instanceof Error ? error.message : 'Sample clearance audit failed.',
                retryable: false,
            }));
        }
    }
};
