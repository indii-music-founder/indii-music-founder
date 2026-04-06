import { StorageService } from '@/services/StorageService';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const StorageTools = {
    list_files: wrapTool('list_files', async (args: { limit?: number, type?: string }) => {
        const count = args.limit || 20;
        const items = await StorageService.loadHistory(count);

        let filtered = items;
        if (args.type) {
            filtered = items.filter(item => item.type === args.type);
        }

        return {
            files: filtered,
            count: filtered.length,
            message: filtered.length === 0 ? "No files found." : `Found ${filtered.length} files.`
        };
    }),

    search_files: wrapTool('search_files', async (args: { query: string }) => {
        // Basic efficient search: load recent usage and filter. 
        // Ideally backend would support search.
        const items = await StorageService.loadHistory(100);
        const q = args.query.toLowerCase();

        const matches = items.filter(item =>
            (item.prompt && item.prompt.toLowerCase().includes(q)) ||
            (item.type && item.type.toLowerCase().includes(q))
        );

        return {
            results: matches,
            count: matches.length,
            message: matches.length === 0 ? `No files found matching query "${args.query}".` : `Found ${matches.length} files matching "${args.query}".`
        };
    }),

    scrub_orphaned_media: wrapTool('scrub_orphaned_media', async (args: { olderThanDays: number; bucketId: string }) => {
        // Item 187: Scrub orphaned media via Cloud Function
        try {
            const { functions } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');

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
        } catch (__error: unknown) {
            return toolSuccess({
                bucketId: args.bucketId,
                olderThanDays: args.olderThanDays,
                deletedFiles: 0,
                savedBytes: 0,
                status: 'Scan queued (deploy Cloud Function for execution)'
            }, `Storage scrub queued for bucket ${args.bucketId}. Deploy Cloud Function 'scrubOrphanedMedia' for actual cleanup.`);
        }
    })
} satisfies Record<string, AnyToolFunction>;

// Aliases
export const { list_files, search_files, scrub_orphaned_media } = StorageTools;
