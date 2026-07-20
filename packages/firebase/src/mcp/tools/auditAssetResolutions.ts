import { auditReleaseArtwork } from '../../assets/AssetResolutionAuditService.js';
import { failedOperationResult, operationResult, requireString, toolResponse } from '../helpers.js';
import { IndiiMcpTool } from '../types.js';

export const auditAssetResolutions: IndiiMcpTool = {
    name: 'audit_asset_resolutions',
    description: 'Byte-inspects owner-scoped release artwork against the versioned DSP cover-art baseline.',
    inputSchema: {
        type: 'object',
        properties: { releaseId: { type: 'string', description: 'Authenticated owner release identifier.' } },
        required: ['releaseId'],
    },
    handler: async (args, context) => {
        const actorUid = context.user.uid;
        let releaseId = 'unknown';
        try {
            releaseId = requireString(args, 'releaseId', 200);
            const audit = await auditReleaseArtwork(actorUid, releaseId);
            return toolResponse(operationResult({
                tool: 'audit_asset_resolutions',
                actorUid,
                status: 'succeeded',
                resourceType: 'release_artwork_audit',
                resourceId: audit.auditId ?? releaseId,
                evidence: audit.artwork ? [{ type: 'storage_object_generation', reference: `${audit.artwork.storagePath}#${audit.artwork.generation}`, sha256: audit.artwork.sha256 }] : [],
                warnings: audit.warnings,
                data: audit as unknown as Record<string, unknown>,
            }));
        } catch (error) {
            return toolResponse(failedOperationResult({
                tool: 'audit_asset_resolutions',
                actorUid,
                resourceType: 'release',
                resourceId: releaseId,
                code: error instanceof TypeError ? 'INVALID_ARGUMENT' : 'ASSET_AUDIT_FAILED',
                message: error instanceof Error ? error.message : 'Asset audit failed.',
                retryable: false,
            }));
        }
    },
};
