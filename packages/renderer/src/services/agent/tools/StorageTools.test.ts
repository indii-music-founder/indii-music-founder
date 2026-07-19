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
