import { beforeEach, describe, expect, it, vi } from 'vitest';
import { judgeDDEXPreFlight } from '@/config/typesafeJudgments';
import type { GoldenMetadata } from '@/services/metadata/types';
import { DDEXPreFlightService } from './DDEXPreFlightService';

vi.mock('@/config/typesafeJudgments', () => ({
    judgeDDEXPreFlight: vi.fn(async (payload: { dspTarget: string }) => ({
        passed: true,
        dspTarget: payload.dspTarget,
        dspPolicyVerified: false,
        blockingOmissions: [],
        advisoryWarnings: [],
    })),
}));

describe('DDEXPreFlightService metadata mapping', () => {
    beforeEach(() => vi.clearAllMocks());

    it('does not invent copyright lines, territories, or valid identifiers from adjacent fields', async () => {
        await DDEXPreFlightService.validateReleaseForDSP('release-1', 'SPOTIFY', {
            artistName: 'Artist',
            labelName: 'Label',
            publisher: 'Publisher',
            isrc: 'ABCDEFGHIJKL',
            explicit: false,
        });

        expect(judgeDDEXPreFlight).toHaveBeenCalledWith(expect.objectContaining({
            cLinePresent: false,
            pLinePresent: false,
            territoriesDeclared: [],
            isrcsMapped: false,
            parentalAdvisoryDeclared: true,
        }));
    });

    it('requires every track to have an ISRC and both copyright line fields', async () => {
        await DDEXPreFlightService.validateReleaseForDSP('release-2', 'APPLE_MUSIC', {
            cLineYear: 2025,
            cLineText: 'Publisher',
            pLineYear: 2025,
            pLineText: 'Artist',
            territories: ['US'],
            isrc: 'USABC2500001',
            tracks: [{ isrc: 'USABC2500001' }, { isrc: '' }] as GoldenMetadata[],
            explicit: true,
        });

        expect(judgeDDEXPreFlight).toHaveBeenCalledWith(expect.objectContaining({
            cLinePresent: true,
            pLinePresent: true,
            territoriesDeclared: ['US'],
            isrcsMapped: false,
            parentalAdvisoryDeclared: true,
        }));

        vi.mocked(judgeDDEXPreFlight).mockClear();
        await DDEXPreFlightService.validateReleaseForDSP('release-2', 'APPLE_MUSIC', {
            cLineYear: 2025,
            cLineText: 'Publisher',
            pLineYear: 2025,
            pLineText: 'Artist',
            territories: ['US'],
            tracks: [{ isrc: 'USABC2500001' }, { isrc: 'USABC2500002' }] as GoldenMetadata[],
            explicit: false,
        });
        expect(judgeDDEXPreFlight).toHaveBeenCalledWith(expect.objectContaining({
            cLinePresent: true,
            pLinePresent: true,
            isrcsMapped: true,
            parentalAdvisoryDeclared: true,
        }));
    });
});
