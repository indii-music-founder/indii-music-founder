import { StorageService } from '@/services/StorageService';
import { wrapTool } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const StorageTools: Record<string, AnyToolFunction> = {
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
    })
};

// Aliases
export const { list_files, search_files } = StorageTools;
