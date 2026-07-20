import { describe, expect, it, vi } from 'vitest';

import { auditReleaseArtworkForOwner } from './auditReleaseArtwork.js';

describe('auditReleaseArtworkForOwner', () => {
    it('binds the audit to the authenticated owner rather than caller-supplied identity', async () => {
        const audit = vi.fn().mockResolvedValue({ status: 'compliant' });
        await auditReleaseArtworkForOwner('owner-1', { releaseId: 'release-1', userId: 'attacker' }, audit);
        expect(audit).toHaveBeenCalledWith('owner-1', 'release-1');
    });

    it('rejects unsafe or missing release identifiers before lookup', async () => {
        const audit = vi.fn();
        await expect(auditReleaseArtworkForOwner('owner-1', { releaseId: '../other' }, audit)).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(audit).not.toHaveBeenCalled();
    });
});
