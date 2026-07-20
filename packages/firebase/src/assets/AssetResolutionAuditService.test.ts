import { describe, expect, it, vi } from 'vitest';

import { auditReleaseArtwork, releaseAttachmentForAudit, resolveOwnedArtworkObjectPath, type AssetAuditRepository, type InspectedArtwork } from './AssetResolutionAuditService.js';

function repository(storagePath = 'artwork/owner-1/cover.png'): AssetAuditRepository {
    return {
        findRelease: vi.fn().mockResolvedValue({ releaseId: 'release-1', ownerUid: 'owner-1', sourceDocumentReference: 'releases/release-1', storagePath, generationProvenance: { source: 'not_recorded' } }),
        findAudit: vi.fn().mockResolvedValue(undefined),
        persistAudit: vi.fn().mockResolvedValue(undefined),
    };
}

const inspected = (overrides: Partial<InspectedArtwork> = {}): InspectedArtwork => ({
    storagePath: 'artwork/owner-1/cover.png', generation: '42', sizeBytes: 10_000,
    sha256: 'a'.repeat(64), width: 3_000, height: 3_000, format: 'png', colorSpace: 'srgb', ...overrides,
});

describe('auditReleaseArtwork', () => {
    it('certifies only byte-inspected compliant artwork and persists evidence', async () => {
        const repo = repository();
        const result = await auditReleaseArtwork('owner-1', 'release-1', {
            repository: repo,
            inspector: { inspect: vi.fn().mockResolvedValue(inspected()) },
        });
        expect(result.status).toBe('compliant');
        expect(result.auditId).toMatch(/^asset_audit_/);
        expect(result.checks.every(check => check.passed)).toBe(true);
        expect(repo.persistAudit).toHaveBeenCalledWith(result);
    });

    it('reports measured noncompliance instead of trusting claimed dimensions', async () => {
        const result = await auditReleaseArtwork('owner-1', 'release-1', {
            repository: repository(),
            inspector: { inspect: vi.fn().mockResolvedValue(inspected({ width: 1_400, height: 1_400, format: 'webp' })) },
        });
        expect(result.status).toBe('non_compliant');
        expect(result.checks.filter(check => check.passed === false).map(check => check.code)).toEqual(['MINIMUM_WIDTH', 'MINIMUM_HEIGHT', 'ALLOWED_FORMAT']);
    });

    it('returns unknown when only an unstable URL or claimed metadata exists', async () => {
        const repo = repository();
        vi.mocked(repo.findRelease).mockResolvedValue({ releaseId: 'release-1', ownerUid: 'owner-1', sourceDocumentReference: 'releases/release-1', generationProvenance: { source: 'not_recorded' } });
        const inspector = { inspect: vi.fn() };
        const result = await auditReleaseArtwork('owner-1', 'release-1', { repository: repo, inspector });
        expect(result.status).toBe('unknown');
        expect(inspector.inspect).not.toHaveBeenCalled();
        expect(repo.persistAudit).not.toHaveBeenCalled();
    });

    it('replays the immutable receipt for the same bytes and generation', async () => {
        const repo = repository();
        const inspector = { inspect: vi.fn().mockResolvedValue(inspected()) };
        const first = await auditReleaseArtwork('owner-1', 'release-1', { repository: repo, inspector });
        vi.mocked(repo.findAudit).mockResolvedValue(first);
        const replay = await auditReleaseArtwork('owner-1', 'release-1', { repository: repo, inspector });
        expect(replay.alreadyExists).toBe(true);
        expect(repo.persistAudit).toHaveBeenCalledTimes(1);
    });

    it('does not reveal another owner release', async () => {
        const repo = repository();
        vi.mocked(repo.findRelease).mockResolvedValue(undefined);
        await expect(auditReleaseArtwork('owner-1', 'release-1', { repository: repo, inspector: { inspect: vi.fn() } }))
            .rejects.toThrow('does not exist for the authenticated owner');
    });
});

describe('releaseAttachmentForAudit', () => {
    it('pins measured bytes, the rules version, and explicitly missing generation provenance', async () => {
        const result = await auditReleaseArtwork('owner-1', 'release-1', {
            repository: repository(),
            inspector: { inspect: vi.fn().mockResolvedValue(inspected()) },
        });
        const attachment = releaseAttachmentForAudit({ ...result, auditId: result.auditId! });
        expect(attachment).toMatchObject({
            schemaVersion: 'release-cover-art-conformance.v1',
            requirementsProfileVersion: 'dsp-cover-art-baseline.v1',
            generationProvenance: { source: 'not_recorded' },
            artwork: { sha256: 'a'.repeat(64), generation: '42' },
        });
        expect(JSON.stringify(attachment)).not.toContain('download_url');
    });
});

describe('resolveOwnedArtworkObjectPath', () => {
    it('accepts only the configured bucket and authenticated owner prefix', () => {
        expect(resolveOwnedArtworkObjectPath('owner-1', 'gs://project.appspot.com/artwork/owner-1/cover.png', 'project.appspot.com'))
            .toBe('artwork/owner-1/cover.png');
        expect(() => resolveOwnedArtworkObjectPath('owner-1', 'gs://other.appspot.com/artwork/owner-1/cover.png', 'project.appspot.com'))
            .toThrow('bucket does not match');
        expect(() => resolveOwnedArtworkObjectPath('owner-1', 'artwork/owner-2/cover.png', 'project.appspot.com'))
            .toThrow('not scoped');
    });

    it('accepts only the canonical immutable cover-object shape', () => {
        const hash = 'c'.repeat(64);
        expect(resolveOwnedArtworkObjectPath('owner-1', `gs://project.appspot.com/covers/owner-1/${hash}/original.png`, 'project.appspot.com'))
            .toBe(`covers/owner-1/${hash}/original.png`);
        expect(() => resolveOwnedArtworkObjectPath('owner-1', 'covers/owner-1/not-a-hash/original.png', 'project.appspot.com'))
            .toThrow('canonical cover path is invalid');
        expect(() => resolveOwnedArtworkObjectPath('owner-1', `covers/owner-1/${hash}/alternate.png`, 'project.appspot.com'))
            .toThrow('canonical cover path is invalid');
    });
});
