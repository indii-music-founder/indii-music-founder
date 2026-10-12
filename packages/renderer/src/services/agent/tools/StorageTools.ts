import { StorageService } from '@/services/StorageService';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { importWithRetry } from '@/utils/dynamicImport';
import { useStore } from '@/core/store';

const isInlineUrl = (value: unknown): value is string =>
    typeof value === 'string' && (value.startsWith('data:') || value.startsWith('blob:'));

/**
 * Uploads are held in the store with their full base64 data URL. Returning
 * that to the model (as `url` or as a markdown thumbnail) puts megabytes of
 * base64 into every tool round-trip, which stalls the agent loop (#407).
 * Replace inline payloads with a compact descriptor; the asset stays
 * addressable through its id / `upload-N` alias (see prepare_print_file).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toAgentSafeItem = (item: Record<string, any>): Record<string, any> => {
    const safe = { ...item };
    if (isInlineUrl(safe.url)) {
        safe.inlineBytes = safe.url.length;
        safe.url = undefined;
        safe.urlNote = `Inline image data omitted from listing. Reference this asset by id "${safe.aliasId || safe.id}".`;
    }
    if (isInlineUrl(safe.thumbnailUrl)) {
        safe.thumbnailUrl = undefined;
    }
    return safe;
};

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
                id: item.id || `brand-asset-${idx}`,
                url: item.url,
                type: 'image',
                _source: 'brand_assets',
                referenceAssetIndex: idx,
                description: item.description,
                category: item.category,
                tags: item.tags,
                subject: item.subject,
            })));
        }
        if (source === 'reference_images' || source === 'all') {
            const references = state.userProfile?.brandKit?.referenceImages || [];
            allItems = allItems.concat(references.map((item, idx) => ({
                id: item.id || `ref-image-${idx}`,
                url: item.url,
                type: 'image',
                _source: 'reference_images',
                referenceImageIndex: idx,
                description: item.description,
                category: item.category,
                tags: item.tags,
                subject: item.subject,
            })));
        }
        if (source === 'uploads' || source === 'all') {
            const uploads = state.uploadedImages || [];
            allItems = allItems.concat(uploads.map((item, idx) => {
                const aliasId = `upload-${idx}`;
                const rawItem = item as Record<string, any>;
                const effectivePrompt = rawItem.prompt || rawItem.name || rawItem.description || rawItem.meta || aliasId;
                const effectiveDescription = rawItem.description || rawItem.prompt || rawItem.name || rawItem.meta;
                return {
                    ...rawItem,
                    id: rawItem.id || aliasId,
                    aliasId,
                    url: rawItem.url,
                    thumbnailUrl: rawItem.thumbnailUrl,
                    storageUri: rawItem.storageUri,
                    type: rawItem.type || 'image',
                    _source: 'uploads',
                    uploadedImageIndex: idx,
                    prompt: effectivePrompt,
                    description: effectiveDescription,
                    category: rawItem.category,
                    tags: rawItem.tags,
                    subject: rawItem.subject,
                    meta: rawItem.meta,
                    origin: rawItem.origin || 'uploaded',
                    timestamp: rawItem.timestamp,
                    projectId: rawItem.projectId,
                };
            }));
        }

        let filtered = allItems;
        if (args.type) {
            filtered = allItems.filter(item => item.type === args.type);
        }
        
        filtered = filtered.slice(0, count);

        if (filtered.length === 0) {
            return toolSuccess({ files: [], count: 0 }, "No files found.");
        }

        // Generate thumbnails (remote URLs only; inline data is listed by id)
        const thumbnailCount = Math.min(filtered.length, 12);
        const shown = filtered.slice(0, thumbnailCount);
        const thumbnails = shown
            .filter(item => item.type === 'image' && !isInlineUrl(item.url))
            .map(item => `![${item.prompt || item.description || item.category || item.id}](${item.url})`)
            .join(' ');

        const inlineLines = shown
            .filter(item => item.type === 'image' && isInlineUrl(item.url))
            .map(item => `- [image] id: ${item.aliasId || item.id} (${item.id}) — ${item.prompt || item.description || 'uploaded image'}`)
            .join('\n');

        const nonImageLines = shown
            .filter(item => item.type !== 'image')
            .map(item => `- [${item.type}] ${item.prompt || item.id}`)
            .join('\n');

        const thumbnailMsg = thumbnails ? `\n\n${thumbnails}` : '';
        const inlineMsg = inlineLines ? `\n\n${inlineLines}` : '';
        const nonImageMsg = nonImageLines ? `\n\n${nonImageLines}` : '';
        const additionalMsg = thumbnailCount < filtered.length ? `\n\n(Plus ${filtered.length - thumbnailCount} more items not shown inline.)` : '';

        return toolSuccess({
            files: filtered.map(toAgentSafeItem),
            count: filtered.length,
        }, `Found ${filtered.length} files.${thumbnailMsg}${inlineMsg}${nonImageMsg}${additionalMsg}`);
    }),

    search_files: wrapTool('search_files', async (args: { query: string; type?: string }) => {
        const state = useStore.getState();
        let allItems: any[] = [];
        
        // Search across all sources
        const galleryItems = await StorageService.loadHistory(100);
        allItems = allItems.concat(galleryItems.map(item => ({ ...item, _source: 'gallery' })));
        
        const assets = state.userProfile?.brandKit?.brandAssets || [];
        allItems = allItems.concat(assets.map((item, idx) => ({
            id: item.id || `brand-asset-${idx}`,
            url: item.url,
            type: 'image',
            _source: 'brand_assets',
            referenceAssetIndex: idx,
            description: item.description,
            category: item.category,
            tags: item.tags,
            subject: item.subject,
        })));
        
        const references = state.userProfile?.brandKit?.referenceImages || [];
        allItems = allItems.concat(references.map((item, idx) => ({
            id: item.id || `ref-image-${idx}`,
            url: item.url,
            type: 'image',
            _source: 'reference_images',
            referenceImageIndex: idx,
            description: item.description,
            category: item.category,
            tags: item.tags,
            subject: item.subject,
        })));
        
        const uploads = state.uploadedImages || [];
        allItems = allItems.concat(uploads.map((item, idx) => {
            const aliasId = `upload-${idx}`;
            const rawItem = item as Record<string, any>;
            const effectivePrompt = rawItem.prompt || rawItem.name || rawItem.description || rawItem.meta || aliasId;
            const effectiveDescription = rawItem.description || rawItem.prompt || rawItem.name || rawItem.meta;
            return {
                ...rawItem,
                id: rawItem.id || aliasId,
                aliasId,
                url: rawItem.url,
                thumbnailUrl: rawItem.thumbnailUrl,
                storageUri: rawItem.storageUri,
                type: rawItem.type || 'image',
                _source: 'uploads',
                uploadedImageIndex: idx,
                prompt: effectivePrompt,
                description: effectiveDescription,
                category: rawItem.category,
                tags: rawItem.tags,
                subject: rawItem.subject,
                meta: rawItem.meta,
                origin: rawItem.origin || 'uploaded',
                timestamp: rawItem.timestamp,
                projectId: rawItem.projectId,
            };
        }));

        const q = args.query.toLowerCase();

        const matches = allItems.filter(item => {
            if (args.type && item.type !== args.type) return false;
            return (
                (item.id && String(item.id).toLowerCase().includes(q)) ||
                (item.aliasId && String(item.aliasId).toLowerCase().includes(q)) ||
                (item.prompt && String(item.prompt).toLowerCase().includes(q)) ||
                (item.name && String(item.name).toLowerCase().includes(q)) ||
                (item.description && String(item.description).toLowerCase().includes(q)) ||
                (item.meta && String(item.meta).toLowerCase().includes(q)) ||
                (item.category && String(item.category).toLowerCase().includes(q)) ||
                (item.subject && String(item.subject).toLowerCase().includes(q)) ||
                (item.storageUri && String(item.storageUri).toLowerCase().includes(q)) ||
                (Array.isArray(item.tags) && item.tags.some((t: string) => String(t).toLowerCase().includes(q))) ||
                (item.type && String(item.type).toLowerCase().includes(q)) ||
                (item._source && String(item._source).toLowerCase().includes(q))
            );
        });

        if (matches.length === 0) {
            return toolSuccess({ results: [], count: 0 }, `No files found matching query "${args.query}".`);
        }

        const thumbnailCount = Math.min(matches.length, 12);
        const shown = matches.slice(0, thumbnailCount);
        const thumbnails = shown
            .filter(item => item.type === 'image' && !isInlineUrl(item.url))
            .map(item => `![${item.prompt || item.description || item.category || item.id}](${item.url})`)
            .join(' ');

        const inlineLines = shown
            .filter(item => item.type === 'image' && isInlineUrl(item.url))
            .map(item => `- [image] id: ${item.aliasId || item.id} (${item.id}) — ${item.prompt || item.description || 'uploaded image'}`)
            .join('\n');

        const nonImageLines = shown
            .filter(item => item.type !== 'image')
            .map(item => `- [${item.type}] ${item.prompt || item.id}`)
            .join('\n');

        const thumbnailMsg = thumbnails ? `\n\n${thumbnails}` : '';
        const inlineMsg = inlineLines ? `\n\n${inlineLines}` : '';
        const nonImageMsg = nonImageLines ? `\n\n${nonImageLines}` : '';
        const additionalMsg = thumbnailCount < matches.length ? `\n\n(Plus ${matches.length - thumbnailCount} more items not shown inline.)` : '';

        return toolSuccess({
            results: matches.map(toAgentSafeItem),
            count: matches.length,
        }, `Found ${matches.length} files matching "${args.query}".${thumbnailMsg}${inlineMsg}${nonImageMsg}${additionalMsg}`);
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
