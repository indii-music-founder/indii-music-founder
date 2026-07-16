import { StorageService } from '@/services/StorageService';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { importWithRetry } from '@/utils/dynamicImport';
import { useStore } from '@/core/store';

export const StorageTools = {
    list_files: wrapTool('list_files', async (args: { source?: 'gallery' | 'brand_assets' | 'reference_images' | 'uploads' | 'all', limit?: number, type?: string }) => {
        const count = args.limit || 20;
        const source = args.source || 'gallery';
        const state = useStore.getState();

        let allItems: any[] = [];

        if (source === 'gallery' || source === 'all') {
            const galleryItems = await StorageService.loadHistory(count);
            allItems = allItems.concat(galleryItems.map(item => ({ ...item, _source: 'gallery' })));
        }
        if (source === 'brand_assets' || source === 'all') {
            const assets = state.userProfile?.brandKit?.brandAssets || [];
            allItems = allItems.concat(assets.map((item, idx) => ({ 
                id: `brand-asset-${idx}`, url: item.url, type: 'image', _source: 'brand_assets', referenceAssetIndex: idx 
            })));
        }
        if (source === 'reference_images' || source === 'all') {
            const references = state.userProfile?.brandKit?.referenceImages || [];
            allItems = allItems.concat(references.map((item, idx) => ({ 
                id: `ref-image-${idx}`, url: item.url, type: 'image', _source: 'reference_images', referenceImageIndex: idx 
            })));
        }
        if (source === 'uploads' || source === 'all') {
            const uploads = state.uploadedImages || [];
            allItems = allItems.concat(uploads.map((item, idx) => ({ 
                id: `upload-${idx}`, url: item.url, type: 'image', _source: 'uploads', uploadedImageIndex: idx 
            })));
        }

        let filtered = allItems;
        if (args.type) {
            filtered = allItems.filter(item => item.type === args.type);
        }
        
        filtered = filtered.slice(0, count);

        if (filtered.length === 0) {
            return toolSuccess({ files: [], count: 0 }, "No files found.");
        }

        // Generate thumbnails
        const thumbnailCount = Math.min(filtered.length, 12);
        const thumbnails = filtered.slice(0, thumbnailCount)
            .filter(item => item.type === 'image')
            .map(item => `![${item.prompt || item.id}](${item.url})`)
            .join(' ');
            
        const nonImageLines = filtered.slice(0, thumbnailCount)
            .filter(item => item.type !== 'image')
            .map(item => `- [${item.type}] ${item.prompt || item.id}`)
            .join('\n');

        const thumbnailMsg = thumbnails ? `\n\n${thumbnails}` : '';
        const nonImageMsg = nonImageLines ? `\n\n${nonImageLines}` : '';
        const additionalMsg = thumbnailCount < filtered.length ? `\n\n(Plus ${filtered.length - thumbnailCount} more items not shown inline.)` : '';

        return toolSuccess({
            files: filtered,
            count: filtered.length,
        }, `Found ${filtered.length} files.${thumbnailMsg}${nonImageMsg}${additionalMsg}`);
    }),

    search_files: wrapTool('search_files', async (args: { query: string }) => {
        const state = useStore.getState();
        let allItems: any[] = [];
        
        // Search across all sources
        const galleryItems = await StorageService.loadHistory(100);
        allItems = allItems.concat(galleryItems.map(item => ({ ...item, _source: 'gallery' })));
        
        const assets = state.userProfile?.brandKit?.brandAssets || [];
        allItems = allItems.concat(assets.map((item, idx) => ({ 
            id: `brand-asset-${idx}`, url: item.url, type: 'image', _source: 'brand_assets', referenceAssetIndex: idx 
        })));
        
        const references = state.userProfile?.brandKit?.referenceImages || [];
        allItems = allItems.concat(references.map((item, idx) => ({ 
            id: `ref-image-${idx}`, url: item.url, type: 'image', _source: 'reference_images', referenceImageIndex: idx 
        })));
        
        const uploads = state.uploadedImages || [];
        allItems = allItems.concat(uploads.map((item, idx) => ({ 
            id: `upload-${idx}`, url: item.url, type: 'image', _source: 'uploads', uploadedImageIndex: idx 
        })));

        const q = args.query.toLowerCase();

        const matches = allItems.filter(item =>
            (item.prompt && item.prompt.toLowerCase().includes(q)) ||
            (item.type && item.type.toLowerCase().includes(q)) ||
            (item._source && item._source.toLowerCase().includes(q))
        );

        if (matches.length === 0) {
            return toolSuccess({ results: [], count: 0 }, `No files found matching query "${args.query}".`);
        }

        const thumbnailCount = Math.min(matches.length, 12);
        const thumbnails = matches.slice(0, thumbnailCount)
            .filter(item => item.type === 'image')
            .map(item => `![${item.prompt || item.id}](${item.url})`)
            .join(' ');
            
        const nonImageLines = matches.slice(0, thumbnailCount)
            .filter(item => item.type !== 'image')
            .map(item => `- [${item.type}] ${item.prompt || item.id}`)
            .join('\n');

        const thumbnailMsg = thumbnails ? `\n\n${thumbnails}` : '';
        const nonImageMsg = nonImageLines ? `\n\n${nonImageLines}` : '';
        const additionalMsg = thumbnailCount < matches.length ? `\n\n(Plus ${matches.length - thumbnailCount} more items not shown inline.)` : '';

        return toolSuccess({
            results: matches,
            count: matches.length,
        }, `Found ${matches.length} files matching "${args.query}".${thumbnailMsg}${nonImageMsg}${additionalMsg}`);
    }),

    scrub_orphaned_media: wrapTool('scrub_orphaned_media', async (args: { olderThanDays: number; bucketId: string }) => {
        // Item 187: Scrub orphaned media via Cloud Function
        try {
            const { functions } = await importWithRetry(() => import('@/services/firebase'));
            const { httpsCallable } = await importWithRetry(() => import('firebase/functions'));

            const scrubFn = httpsCallable<
                { olderThanDays: number; bucketId: string },
                { deletedFiles: number; savedBytes: number; status: string }
            >(functions, 'scrubOrphanedMedia');

            const result = await scrubFn({
                olderThanDays: args.olderThanDays,
                bucketId: args.bucketId
            });

            return toolSuccess({
                bucketId: args.bucketId,
                olderThanDays: args.olderThanDays,
                deletedFiles: result.data.deletedFiles,
                savedBytes: result.data.savedBytes,
                status: result.data.status
            }, `Storage scrub completed for bucket ${args.bucketId}. Deleted ${result.data.deletedFiles} orphaned files, saved ${(result.data.savedBytes / 1024 / 1024).toFixed(1)} MB.`);
        } catch (error: unknown) {
            return toolError(
                `Storage scrub unavailable: Cloud Function 'scrubOrphanedMedia' not deployed. Existing cleanup jobs: cleanupOrphanedVideos (scheduled), cleanupExpiredVideoTemps (scheduled), flagVideosForArchival (manual). ${error instanceof Error ? error.message : ''}`,
                'STORAGE_SCRUB_UNAVAILABLE'
            );
        }
    })
} satisfies Record<string, AnyToolFunction>;

// Aliases
export const { list_files, search_files, scrub_orphaned_media } = StorageTools;
