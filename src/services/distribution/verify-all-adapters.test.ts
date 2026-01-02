import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SymphonicAdapter } from '@/services/distribution/adapters/SymphonicAdapter';
import { DistroKidAdapter } from '@/services/distribution/adapters/DistroKidAdapter';
import { TuneCoreAdapter } from '@/services/distribution/adapters/TuneCoreAdapter';
import { CDBabyAdapter } from '@/services/distribution/adapters/CDBabyAdapter';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { ReleaseAssets, IDistributorAdapter } from '@/services/distribution/types/distributor';

describe('All Distribution Adapters Integration', () => {
    let tempDir: string;
    let audioPath: string;
    let coverPath: string;
    let mockAssets: ReleaseAssets;

    const mockMetadata: ExtendedGoldenMetadata = {
        trackTitle: 'Universal Harmony',
        artistName: 'The Generic Band',
        releaseDate: '2025-02-01',
        releaseType: 'Single',
        genre: 'Pop',
        pLineYear: 2025,
        cLineText: 'The Generic Band',
        language: 'en',
        isrc: 'US-GEN-25-00001',
        upc: '123456789012',
        catalogNumber: 'GEN-001',
        dpid: 'PADPIDA2014040101U',
        labelName: 'Generic Records',
        marketingComment: 'A test release for adapter verification.',
        originalReleaseDate: '2025-02-01',
        pLineText: 'The Generic Band',
        cLineYear: 2025,
        explicit: false,
        splits: [],
        pro: 'ASCAP',
        publisher: 'Generic Records',
        containsSamples: false,
        isGolden: true,
        territories: ['Worldwide'],
        distributionChannels: ['streaming', 'download'],
        aiGeneratedContent: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false
        }
    } as ExtendedGoldenMetadata;

    beforeAll(() => {
        // Setup Mock Assets
        tempDir = path.join(os.tmpdir(), 'indiiOS_verify_assets');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        audioPath = path.join(tempDir, 'test_audio.wav');
        coverPath = path.join(tempDir, 'test_cover.jpg');

        fs.writeFileSync(audioPath, 'MOCK AUDIO DATA');
        fs.writeFileSync(coverPath, 'MOCK IMAGE DATA');

        mockAssets = {
            audioFiles: [{
                url: `file://${audioPath}`,
                mimeType: 'audio/wav',
                format: 'wav',
                sizeBytes: 1024,
                sampleRate: 44100,
                bitDepth: 16
            }],
            coverArt: {
                url: `file://${coverPath}`,
                mimeType: 'image/jpeg',
                width: 3000,
                height: 3000,
                sizeBytes: 2048
            }
        };
    });

    afterAll(() => {
        // Cleanup
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    const adapters: IDistributorAdapter[] = [
        new SymphonicAdapter(),
        new DistroKidAdapter(),
        new TuneCoreAdapter(),
        new CDBabyAdapter()
    ];

    describe.each(adapters.map(a => [a.name, a]))('%s Adapter', (name, adapter) => {
        it('should connect successfully', async () => {
            await expect(adapter.connect({
                apiKey: 'test-api-key',
                accessToken: 'test-access-token',
                accountId: 'test-account'
            })).resolves.not.toThrow();
        });

        it('should create release successfully', async () => {
            const result = await adapter.createRelease(mockMetadata, mockAssets);
            expect(result.success).toBe(true);
            expect(result.status).toBe('delivered');
            expect(result.distributorReleaseId).toBeDefined();
        });

        it('should disconnect successfully', async () => {
            await expect(adapter.disconnect()).resolves.not.toThrow();
        });
    });
});
