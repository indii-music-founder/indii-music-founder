import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageTools } from './StorageTools';
import { StorageService } from '@/services/StorageService';
import { useStore } from '@/core/store';

vi.mock('@/services/StorageService', () => ({
    StorageService: {
        loadHistory: vi.fn()
    }
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

// Mock dynamic import for scrub_orphaned_media
vi.mock('@/utils/dynamicImport', () => ({
    importWithRetry: vi.fn().mockRejectedValue(new Error('Not tested here'))
}));

describe('StorageTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('list_files', () => {
        it('returns empty message when history is empty', async () => {
            vi.mocked(StorageService.loadHistory).mockResolvedValue([]);
            vi.mocked(useStore.getState).mockReturnValue({
                userProfile: { brandKit: { brandAssets: [], referenceImages: [] } },
                uploadedImages: []
            } as any);

            const result = await StorageTools.list_files({ source: 'gallery', limit: 10 });
            
            expect(result.success).toBe(true);
            expect(result.message).toBe('No files found.');
            expect(result.data.count).toBe(0);
        });

        it('produces markdown thumbnails for image items', async () => {
            vi.mocked(StorageService.loadHistory).mockResolvedValue([
                { id: '1', url: 'https://test.com/img1.png', type: 'image', prompt: 'test img', timestamp: Date.now(), projectId: 'test' }
            ]);
            vi.mocked(useStore.getState).mockReturnValue({} as any);

            const result = await StorageTools.list_files({ source: 'gallery', limit: 10 });
            
            expect(result.success).toBe(true);
            expect(result.data.count).toBe(1);
            expect(result.message).toContain('![test img](https://test.com/img1.png)');
        });

        it('sources assets from the correct profile fields when source is all', async () => {
            vi.mocked(StorageService.loadHistory).mockResolvedValue([
                { id: '1', url: 'https://test.com/gallery.png', type: 'image', prompt: 'gallery', timestamp: Date.now(), projectId: 'test' }
            ]);
            vi.mocked(useStore.getState).mockReturnValue({
                userProfile: { 
                    brandKit: { 
                        brandAssets: [{ url: 'https://test.com/brand.png' }], 
                        referenceImages: [{ url: 'https://test.com/ref.png' }] 
                    } 
                },
                uploadedImages: [{ url: 'https://test.com/upload.png' }]
            } as any);

            const result = await StorageTools.list_files({ source: 'all', limit: 10 });
            
            expect(result.success).toBe(true);
            expect(result.data.count).toBe(4);
            expect(result.message).toContain('![gallery](https://test.com/gallery.png)');
            expect(result.message).toContain('![brand-asset-0](https://test.com/brand.png)');
            expect(result.message).toContain('![ref-image-0](https://test.com/ref.png)');
            expect(result.message).toContain('![upload-0](https://test.com/upload.png)');
        });

        it('preserves brand-asset metadata so agents can identify assets like a headshot', async () => {
            vi.mocked(StorageService.loadHistory).mockResolvedValue([]);
            vi.mocked(useStore.getState).mockReturnValue({
                userProfile: {
                    brandKit: {
                        brandAssets: [{ id: 'hs-1', url: 'https://test.com/headshot.png', description: 'Headshot', category: 'headshot', subject: 'Dave' }],
                        referenceImages: []
                    }
                },
                uploadedImages: []
            } as any);

            const result = await StorageTools.list_files({ source: 'brand_assets', limit: 10 });

            expect(result.success).toBe(true);
            expect(result.data.count).toBe(1);
            expect((result.data as any).files[0]).toMatchObject({ id: 'hs-1', description: 'Headshot', category: 'headshot', subject: 'Dave' });
            expect(result.message).toContain('Headshot');
        });

        it('preserves full HistoryItem metadata for uploaded images when source is uploads', async () => {
            vi.mocked(StorageService.loadHistory).mockResolvedValue([]);
            vi.mocked(useStore.getState).mockReturnValue({
                userProfile: { brandKit: { brandAssets: [], referenceImages: [] } },
                uploadedImages: [
                    {
                        id: 'upload-uuid-1',
                        url: 'https://storage.googleapis.com/test-bucket/shattered-clock.png',
                        prompt: 'shattered black clock',
                        description: 'A surreal broken clock with obsidian glass',
                        tags: ['album-art', 'dark'],
                        category: 'other',
                        subject: 'clock',
                        storageUri: 'gs://test-bucket/shattered-clock.png',
                        type: 'image',
                        timestamp: 1712345678,
                        projectId: 'project-99',
                        origin: 'uploaded'
                    }
                ]
            } as any);

            const result = await StorageTools.list_files({ source: 'uploads', limit: 10 });

            expect(result.success).toBe(true);
            expect(result.data.count).toBe(1);
            const file = (result.data as any).files[0];
            expect(file).toMatchObject({
                id: 'upload-uuid-1',
                aliasId: 'upload-0',
                prompt: 'shattered black clock',
                description: 'A surreal broken clock with obsidian glass',
                tags: ['album-art', 'dark'],
                category: 'other',
                subject: 'clock',
                storageUri: 'gs://test-bucket/shattered-clock.png',
                type: 'image',
                uploadedImageIndex: 0,
                origin: 'uploaded',
                _source: 'uploads'
            });
            expect(result.message).toContain('![shattered black clock](https://storage.googleapis.com/test-bucket/shattered-clock.png)');
        });
    });

    describe('search_files', () => {
        it('should return files matching the query in prompt', async () => {
            vi.mocked(StorageService.loadHistory).mockResolvedValue([
                { id: '1', type: 'image', prompt: 'sunset', url: 'http://img1.com', timestamp: 1000, projectId: 'test' }
            ]);
            vi.mocked(useStore.getState).mockReturnValue({} as any);

            const result = await StorageTools.search_files({ query: 'sunset' });

            expect(result.success).toBe(true);
            expect(result.data.count).toBe(1);
            expect(result.message).toContain('![sunset](http://img1.com)');
        });

        it('should be case-insensitive', async () => {
            vi.mocked(StorageService.loadHistory).mockResolvedValue([
                { id: '1', type: 'image', prompt: 'cyberpunk', url: 'http://img1.com', timestamp: 1000, projectId: 'test' }
            ]);
            vi.mocked(useStore.getState).mockReturnValue({} as any);

            const result = await StorageTools.search_files({ query: 'CYBERPUNK' });

            expect(result.success).toBe(true);
            expect(result.data.count).toBe(1);
            expect(result.message).toContain('cyberpunk');
        });

        it('finds brand assets by category (headshot)', async () => {
            vi.mocked(StorageService.loadHistory).mockResolvedValue([]);
            vi.mocked(useStore.getState).mockReturnValue({
                userProfile: {
                    brandKit: {
                        brandAssets: [{ id: 'hs-1', url: 'https://test.com/headshot.png', description: 'Headshot', category: 'headshot' }],
                        referenceImages: []
                    }
                },
                uploadedImages: []
            } as any);

            const result = await StorageTools.search_files({ query: 'headshot' });

            expect(result.success).toBe(true);
            expect(result.data.count).toBe(1);
            expect(result.message).toContain('Headshot');
        });

        it('finds uploaded images by prompt, description, and tags', async () => {
            vi.mocked(StorageService.loadHistory).mockResolvedValue([]);
            vi.mocked(useStore.getState).mockReturnValue({
                userProfile: { brandKit: { brandAssets: [], referenceImages: [] } },
                uploadedImages: [
                    {
                        id: 'clock-asset-id',
                        url: 'https://test.com/shattered_clock.png',
                        prompt: 'shattered black clock',
                        description: 'Surreal album cover art',
                        tags: ['clock', 'dark-art'],
                        type: 'image'
                    }
                ]
            } as any);

            const searchPrompt = await StorageTools.search_files({ query: 'shattered black clock' });
            expect(searchPrompt.success).toBe(true);
            expect(searchPrompt.data.count).toBe(1);
            expect((searchPrompt.data as any).results[0].id).toBe('clock-asset-id');
            expect(searchPrompt.message).toContain('shattered black clock');

            const searchTag = await StorageTools.search_files({ query: 'dark-art' });
            expect(searchTag.success).toBe(true);
            expect(searchTag.data.count).toBe(1);

            const searchAlias = await StorageTools.search_files({ query: 'upload-0' });
            expect(searchAlias.success).toBe(true);
            expect(searchAlias.data.count).toBe(1);
        });

        it('filters search results by type when type parameter is provided', async () => {
            vi.mocked(StorageService.loadHistory).mockResolvedValue([]);
            vi.mocked(useStore.getState).mockReturnValue({
                userProfile: { brandKit: { brandAssets: [], referenceImages: [] } },
                uploadedImages: [
                    {
                        id: 'clock-img',
                        url: 'https://test.com/clock.png',
                        prompt: 'clock cover image',
                        type: 'image'
                    },
                    {
                        id: 'clock-audio',
                        url: 'https://test.com/clock.wav',
                        prompt: 'clock ticking master',
                        type: 'audio'
                    }
                ]
            } as any);

            const imgOnly = await StorageTools.search_files({ query: 'clock', type: 'image' });
            expect(imgOnly.success).toBe(true);
            expect(imgOnly.data.count).toBe(1);
            expect((imgOnly.data as any).results[0].id).toBe('clock-img');

            const audioOnly = await StorageTools.search_files({ query: 'clock', type: 'audio' });
            expect(audioOnly.success).toBe(true);
            expect(audioOnly.data.count).toBe(1);
            expect((audioOnly.data as any).results[0].id).toBe('clock-audio');
        });

        it('should return empty list if no matches found', async () => {
            vi.mocked(StorageService.loadHistory).mockResolvedValue([]);
            vi.mocked(useStore.getState).mockReturnValue({} as any);

            const result = await StorageTools.search_files({ query: 'unicorn' });

            expect(result.success).toBe(true);
            expect(result.data.count).toBe(0);
            expect(result.message).toContain('No files found');
        });
    });
});
