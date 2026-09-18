import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    FreeMiniCampaignService,
    FREE_CAMPAIGN_LIMITS,
    type MiniCampaignPack,
} from './FreeMiniCampaignService';
import { CloudStorageService } from '@/services/CloudStorageService';

vi.mock('@/services/CloudStorageService', () => ({
    CloudStorageService: {
        deleteStorageUri: vi.fn().mockResolvedValue(undefined),
    },
}));

describe('FreeMiniCampaignService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validateAudioFile', () => {
        it('throws when no file is provided', () => {
            expect(() => FreeMiniCampaignService.validateAudioFile(null as unknown as File)).toThrow(
                'An audio file is required',
            );
        });

        it('throws when audio file exceeds max size', () => {
            const largeFile = new File(['x'.repeat(100)], 'huge-master.wav', { type: 'audio/wav' });
            Object.defineProperty(largeFile, 'size', { value: 40 * 1024 * 1024 });

            expect(() => FreeMiniCampaignService.validateAudioFile(largeFile)).toThrow(
                'exceeds the 35MB limit',
            );
        });

        it('throws when file format is unsupported', () => {
            const badFile = new File(['text'], 'notes.txt', { type: 'text/plain' });
            expect(() => FreeMiniCampaignService.validateAudioFile(badFile)).toThrow(
                'Unsupported audio format',
            );
        });

        it('accepts valid audio files (MP3, WAV, AAC, M4A)', () => {
            const mp3 = new File(['audio-data'], 'master.mp3', { type: 'audio/mpeg' });
            const wav = new File(['audio-data'], 'master.wav', { type: 'audio/wav' });

            expect(() => FreeMiniCampaignService.validateAudioFile(mp3)).not.toThrow();
            expect(() => FreeMiniCampaignService.validateAudioFile(wav)).not.toThrow();
        });
    });

    describe('validateVisualFile', () => {
        it('throws when no image file is provided', () => {
            expect(() => FreeMiniCampaignService.validateVisualFile(null as unknown as File)).toThrow(
                'A visual image file is required',
            );
        });

        it('throws when visual file exceeds 15MB limit', () => {
            const largeImage = new File(['img'], 'heavy.png', { type: 'image/png' });
            Object.defineProperty(largeImage, 'size', { value: 16 * 1024 * 1024 });

            expect(() => FreeMiniCampaignService.validateVisualFile(largeImage)).toThrow(
                'exceeds the 15MB limit',
            );
        });

        it('throws when image format is unsupported', () => {
            const badImage = new File(['gif'], 'anim.gif', { type: 'image/gif' });
            expect(() => FreeMiniCampaignService.validateVisualFile(badImage)).toThrow(
                'Unsupported image format',
            );
        });

        it('accepts valid images (PNG, JPEG, WebP)', () => {
            const png = new File(['img'], 'cover.png', { type: 'image/png' });
            const jpeg = new File(['img'], 'cover.jpg', { type: 'image/jpeg' });
            const webp = new File(['img'], 'cover.webp', { type: 'image/webp' });

            expect(() => FreeMiniCampaignService.validateVisualFile(png)).not.toThrow();
            expect(() => FreeMiniCampaignService.validateVisualFile(jpeg)).not.toThrow();
            expect(() => FreeMiniCampaignService.validateVisualFile(webp)).not.toThrow();
        });
    });

    describe('createMiniCampaignPack', () => {
        it('assembles a pack with 1:1 cover, 9:16 story, and 8s clip without watermarks', () => {
            const pack = FreeMiniCampaignService.createMiniCampaignPack({
                title: 'Midnight Echoes',
                artistName: 'Detroit Sound',
                visualUrl: 'https://storage.googleapis.com/test-bucket/cover.jpg',
                audioUrl: 'https://storage.googleapis.com/test-bucket/master.mp3',
                durationSeconds: 210,
                clipStartSeconds: 30,
                storageUris: [
                    'gs://test-bucket/cover.jpg',
                    'gs://test-bucket/story.jpg',
                    'gs://test-bucket/master.mp3',
                ],
            });

            expect(pack.title).toBe('Midnight Echoes');
            expect(pack.artistName).toBe('Detroit Sound');
            expect(pack.watermarkPolicy).toBe('NONE');
            expect(pack.trackMeta.durationSeconds).toBe(210);
            expect(pack.trackMeta.clipStartSeconds).toBe(30);
            expect(pack.trackMeta.clipDurationSeconds).toBe(FREE_CAMPAIGN_LIMITS.defaultClipDurationSeconds);

            expect(pack.assets).toHaveLength(3);

            const squareCover = pack.assets.find(a => a.aspectRatio === '1:1');
            const storyCover = pack.assets.find(a => a.aspectRatio === '9:16');
            const audioClip = pack.assets.find(a => a.aspectRatio === 'audio');

            expect(squareCover).toBeDefined();
            expect(squareCover?.isWatermarked).toBe(false);

            expect(storyCover).toBeDefined();
            expect(storyCover?.isWatermarked).toBe(false);

            expect(audioClip).toBeDefined();
            expect(audioClip?.isWatermarked).toBe(false);
        });
    });

    describe('enforceSaveOrDelete', () => {
        const mockPack: MiniCampaignPack = {
            id: 'minicamp_123',
            title: 'Test Song',
            artistName: 'Artist',
            createdAt: new Date().toISOString(),
            trackMeta: {
                title: 'Test Song',
                durationSeconds: 120,
                clipStartSeconds: 0,
                clipDurationSeconds: 8,
            },
            assets: [
                {
                    id: '1',
                    type: 'square_cover',
                    title: 'Cover',
                    url: 'blob:http://localhost/cover-blob',
                    aspectRatio: '1:1',
                    isWatermarked: false,
                },
            ],
            storageUris: [
                'gs://test-bucket/test_cover.png',
                'gs://test-bucket/test_audio.mp3',
            ],
            watermarkPolicy: 'NONE',
        };

        it('saves pack to library when choice is "save"', async () => {
            const result = await FreeMiniCampaignService.enforceSaveOrDelete('save', mockPack);

            expect(result.action).toBe('saved');
            expect(result.purgedUrisCount).toBe(0);
            expect(CloudStorageService.deleteStorageUri).not.toHaveBeenCalled();
            expect(result.message).toContain('saved to your project library');
        });

        it('purges all storage URIs when choice is "delete"', async () => {
            const result = await FreeMiniCampaignService.enforceSaveOrDelete('delete', mockPack);

            expect(result.action).toBe('deleted');
            expect(result.purgedUrisCount).toBe(2);
            expect(CloudStorageService.deleteStorageUri).toHaveBeenCalledWith('gs://test-bucket/test_cover.png');
            expect(CloudStorageService.deleteStorageUri).toHaveBeenCalledWith('gs://test-bucket/test_audio.mp3');
            expect(result.message).toContain('permanently deleted');
        });
    });
});
