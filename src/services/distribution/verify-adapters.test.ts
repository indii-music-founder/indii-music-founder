import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DistroKidAdapter } from '@/services/distribution/adapters/DistroKidAdapter';
import { TuneCoreAdapter } from '@/services/distribution/adapters/TuneCoreAdapter';
import { CDBabyAdapter } from '@/services/distribution/adapters/CDBabyAdapter';
import { SymphonicAdapter } from '@/services/distribution/adapters/SymphonicAdapter';
import { DistributorService } from '@/services/distribution/DistributorService';
import { ernService } from '@/services/ddex/ERNService';
import { dsrService } from '@/services/ddex/DSRService';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { ReleaseAssets } from '@/services/distribution/types/distributor';

describe('Distribution System Verification', () => {
    const mockMetadata: ExtendedGoldenMetadata = {
        trackTitle: 'Neon Nights',
        artistName: 'The Synthwave Collective',
        isrc: 'US-DK1-25-00001',
        explicit: false,
        genre: 'Synthwave',
        splits: [],
        pro: 'ASCAP',
        publisher: 'Retro Records',
        containsSamples: false,
        isGolden: true,
        labelName: 'Retro Records',
        dpid: 'PA-DPIDA-2025122601-E',
        releaseType: 'Single',
        releaseDate: '2025-02-01',
        territories: ['Worldwide'],
        distributionChannels: ['streaming', 'download'],
        copyrightYear: '2025',
        copyrightOwner: 'The Synthwave Collective',
        aiGeneratedContent: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false
        }
    } as ExtendedGoldenMetadata;

    const mockAssets: ReleaseAssets = {
        audioFiles: [{
            url: 'file:///path/to/song.wav',
            mimeType: 'audio/wav',
            sizeBytes: 40 * 1024 * 1024,
            format: 'wav',
            sampleRate: 44100,
            bitDepth: 16,
        }],
        coverArt: {
            url: 'file:///path/to/cover.jpg',
            mimeType: 'image/jpeg',
            width: 3000,
            height: 3000,
            sizeBytes: 5 * 1024 * 1024,
        },
    };

    let distrokid: DistroKidAdapter;
    let tunecore: TuneCoreAdapter;
    let cdbaby: CDBabyAdapter;
    let symphonic: SymphonicAdapter;

    beforeAll(() => {
        distrokid = new DistroKidAdapter();
        tunecore = new TuneCoreAdapter();
        cdbaby = new CDBabyAdapter();
        symphonic = new SymphonicAdapter();

        DistributorService.registerAdapter(distrokid);
        DistributorService.registerAdapter(tunecore);
        DistributorService.registerAdapter(cdbaby);
        DistributorService.registerAdapter(symphonic);
    });

    describe('Adapter Registration', () => {
        it('should register all adapters', () => {
            const registered = DistributorService.getRegisteredDistributors();
            expect(registered).toContain('distrokid');
            expect(registered).toContain('tunecore');
            expect(registered).toContain('cdbaby');
            expect(registered).toContain('symphonic');
        });
    });

    describe('DistroKid Adapter', () => {
        it('should connect successfully', async () => {
            await expect(distrokid.connect({ apiKey: 'mock-key' })).resolves.not.toThrow();
        });

        it('should validate metadata', async () => {
            const validation = await distrokid.validateMetadata(mockMetadata);
            expect(validation.isValid).toBe(true);
        });

        it('should create release', async () => {
            const result = await distrokid.createRelease(mockMetadata, mockAssets);
            expect(result.success).toBe(true);
            expect(result.distributorReleaseId).toBeDefined();
        });
    });

    describe('TuneCore Adapter', () => {
        it('should connect successfully', async () => {
            await expect(tunecore.connect({ accessToken: 'mock-token' })).resolves.not.toThrow();
        });

        it('should create release', async () => {
            const result = await tunecore.createRelease(mockMetadata, mockAssets);
            expect(result.success).toBe(true);
            expect(result.distributorReleaseId).toBeDefined();
        });
    });

    describe('CD Baby Adapter', () => {
        it('should connect successfully', async () => {
            await expect(cdbaby.connect({ apiKey: 'mock-key' })).resolves.not.toThrow();
        });

        it('should create release', async () => {
            const result = await cdbaby.createRelease(mockMetadata, mockAssets);
            expect(result.success).toBe(true);
            expect(result.distributorReleaseId).toBeDefined();
        });
    });

    describe('Symphonic Adapter', () => {
        it('should connect successfully', async () => {
            await expect(symphonic.connect({ apiKey: 'mock-key', accountId: 'partner-123' })).resolves.not.toThrow();
        });

        it('should validate metadata', async () => {
            const validation = await symphonic.validateMetadata(mockMetadata);
            expect(validation.isValid).toBe(true);
        });

        it('should create release', async () => {
            const result = await symphonic.createRelease(mockMetadata, mockAssets);
            expect(result.success).toBe(true);
            expect(result.distributorReleaseId).toBeDefined();
        });
    });

    describe('ERN Service', () => {
        it('should generate ERN XML', async () => {
            const result = await ernService.generateERN(mockMetadata, 'PADPIDA2014040101U', 'PADPIDB2014040101U');
            expect(result.success).toBe(true);
            expect(result.xml).toBeDefined();
            expect(result.xml!.length).toBeGreaterThan(0);
        });
    });

    describe('DSR Service', () => {
        it('should ingest flat file DSR', async () => {
            const mockDSRContent = `TransactionId\tISRC\tTitle\tUsageType\tUsageCount\tRevenue\tCurrency\tTerritory
TX-001\tUS-DK1-25-00001\tNeon Nights\tStream\t1000\t5.00\tUSD\tUS
TX-002\tUS-DK1-25-00001\tNeon Nights\tDownload\t10\t9.90\tUSD\tUS`;

            const result = await dsrService.ingestFlatFile(mockDSRContent);
            expect(result.success).toBe(true);
            expect(result.data?.transactions.length).toBe(2);
            expect(result.data?.summary.totalRevenue).toBe(14.9);
        });
    });
});
