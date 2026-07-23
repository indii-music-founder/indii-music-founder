import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../assets/AssetResolutionAuditService.js', () => ({ auditReleaseArtwork: vi.fn() }));

import { auditReleaseArtwork } from '../../assets/AssetResolutionAuditService.js';
import { auditAssetResolutions } from './auditAssetResolutions.js';

describe('auditAssetResolutions MCP tool', () => {
    beforeEach(() => vi.clearAllMocks());

    it('derives ownership exclusively from the authenticated context', async () => {
        vi.mocked(auditReleaseArtwork).mockResolvedValue({
            schemaVersion: 'asset-resolution-audit.v1', auditId: 'audit-1', ownerUid: 'owner-1', releaseId: 'release-1',
            status: 'compliant', profile: { profileId: 'dsp-cover-art-baseline.v1', minimumWidth: 3_000, minimumHeight: 3_000, squareRequired: true, allowedFormats: ['jpeg', 'png'], allowedColorSpaces: ['srgb', 'rgb'] },
            sourceDocumentReference: 'releases/release-1', artwork: { storagePath: 'artwork/owner-1/cover.png', generation: '42', sizeBytes: 1, sha256: 'a'.repeat(64), width: 3_000, height: 3_000, format: 'png', colorSpace: 'srgb' },
            // Required on the receipt: technical conformance does not establish who
            // created the image, so absent evidence is recorded as such rather than inferred.
            generationProvenance: { source: 'not_recorded' },
            checks: [], warnings: [], alreadyExists: false,
        });
        const response = await auditAssetResolutions.handler({ releaseId: 'release-1', userId: 'attacker' }, { user: { uid: 'owner-1' } as never });
        expect(auditReleaseArtwork).toHaveBeenCalledWith('owner-1', 'release-1');
        expect(response.structuredContent).toMatchObject({ status: 'succeeded', actorUid: 'owner-1' });
    });

    it('returns a structured validation failure', async () => {
        const response = await auditAssetResolutions.handler({}, { user: { uid: 'owner-1' } as never });
        expect(response.structuredContent).toMatchObject({ status: 'failed', error: { code: 'INVALID_ARGUMENT' } });
        expect(response.isError).toBe(true);
    });
});
