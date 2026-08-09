import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    listCurrentUserReleases: vi.fn(),
}));

vi.mock('@/services/distribution/ReleaseCatalogService', () => ({
    releaseCatalogService: { listCurrentUserReleases: mocks.listCurrentUserReleases },
    getReleaseTitle: (data: Record<string, any>) => data.metadata?.trackTitle ?? data.trackTitle ?? data.title,
    getReleaseIsrc: (data: Record<string, any>) => data.metadata?.isrc ?? data.assets?.isrc ?? data.isrc,
    getReleaseWriters: (data: Record<string, any>) => data.metadata?.writers?.map((writer: any) => writer.name) ?? data.writers ?? [],
    getReleaseDate: (data: Record<string, any>) => {
        const value = data.metadata?.releaseDate ?? data.releaseDate;
        return value ? new Date(value) : undefined;
    },
}));

import { PublishingTools } from './PublishingTools';
import { Web3Tools } from './Web3Tools';
import { CoreTools } from './CoreTools';

describe('release-backed agent tools', () => {
    beforeEach(() => mocks.listCurrentUserReleases.mockReset());

    it('finds a real local PRO candidate without calling it registered', async () => {
        mocks.listCurrentUserReleases.mockResolvedValue([{
            id: 'release-1',
            data: {
                metadata: {
                    trackTitle: 'Night Shift',
                    isrc: 'US-ABC-26-00001',
                    writers: [{ name: 'A. Writer' }],
                },
            },
        }]);

        const result = await PublishingTools.query_pro_database({ trackTitle: 'Night Shift' });
        expect(result.success).toBe(true);
        expect(result.data.matchFound).toBe(true);
        expect(result.data.existingRecords[0]).toMatchObject({
            isrc: 'US-ABC-26-00001',
            status: 'PRO registration unverified',
        });
    });

    it('surfaces a release lookup failure instead of converting it to no match', async () => {
        mocks.listCurrentUserReleases
            .mockRejectedValueOnce(new Error('permission-denied'))
            .mockRejectedValueOnce(new Error('permission-denied'))
            .mockRejectedValueOnce(new Error('permission-denied'));
        const proResult = await PublishingTools.query_pro_database({ trackTitle: 'Night Shift' });
        const web3Result = await Web3Tools.trace_blockchain_royalty({
            isrc: 'US-ABC-26-00001',
            totalRevenue: 100,
        });
        const calendarResult = await CoreTools.check_calendar_notifications({});

        for (const result of [proResult, web3Result, calendarResult]) {
            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('RELEASE_CATALOG_LOOKUP_FAILED');
        }
    });

    it('reads blockchain evidence and upcoming dates from canonical document shapes', async () => {
        mocks.listCurrentUserReleases.mockResolvedValue([{
            id: 'release-1',
            data: {
                metadata: {
                    trackTitle: 'Night Shift',
                    isrc: 'US-ABC-26-00001',
                    releaseDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
                },
                blockchainTxHash: '0xabc123',
                chain: 'Polygon',
            },
        }]);

        const web3Result = await Web3Tools.trace_blockchain_royalty({
            isrc: 'US-ABC-26-00001',
            totalRevenue: 100,
        });
        const calendarResult = await CoreTools.check_calendar_notifications({});

        expect(web3Result.success).toBe(true);
        expect(web3Result.data.blockchainHash).toBe('0xabc123');
        expect(calendarResult.success).toBe(true);
        expect(calendarResult.data.newNotifications).toBe(1);
        expect(calendarResult.data.notifications[0].releaseId).toBe('release-1');
    });

    it('never fabricates an active token-gated preview or share URL', async () => {
        const result = await Web3Tools.generate_token_gated_preview({
            trackTitle: 'Night Shift',
            tokenContractAddress: '0x1234567890abcdef1234567890abcdef12345678',
        });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('NOT_IMPLEMENTED');
        expect(result.data?.previewUrl).toBeUndefined();
        expect(result.message).toMatch(/no share URL was created/i);
    });
});
