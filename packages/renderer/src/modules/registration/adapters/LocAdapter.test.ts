import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    persistOrgRecord: vi.fn(),
}));

vi.mock('../services/RegistrationPersistence', () => ({
    persistOrgRecord: mocks.persistOrgRecord,
}));

import { LocAdapter } from './LocAdapter';
import type { CatalogTrack } from '../types';

const track: CatalogTrack = {
    id: 'SONIC-master',
    title: 'Water Finds a Way',
    artistName: 'indii',
    writersAndContributors: [{ name: 'Writer One', role: 'songwriter', percentage: 100 }],
    isrc: 'USABC2600001',
    isPublished: false,
};

const form = {
    claimScope: 'Sound recording only',
    workTitle: track.title,
    yearOfCreation: '2026',
    authorName: 'Writer One',
    isPublished: false,
    workForHire: false,
    copyrightClaimant: 'Writer One',
};

describe('LocAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.persistOrgRecord.mockResolvedValue(true);
    });

    it('saves a prepared manual filing without attempting browser interaction', async () => {
        const result = await LocAdapter.submit(form, track, 'owner-1');

        expect(result.success).toBe(false);
        expect(mocks.persistOrgRecord).toHaveBeenCalledWith(
            'owner-1',
            track.id,
            'loc',
            form,
            undefined
        );
        expect(result.requiresManualStep).toBe(true);
        expect(result.manualStepUrl).toContain('copyright.gov');
        expect(result.manualStepInstructions).toContain('no information was entered or submitted');
    });
});
