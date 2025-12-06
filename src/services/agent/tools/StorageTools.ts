import { StorageService } from '@/services/StorageService';

export const StorageTools = {
    list_files: async (args: { limit?: number, type?: string }) => {
        try {
            const count = args.limit || 20;
            const items = await StorageService.loadHistory(count);

            let filtered = items;
            if (args.type) {
                filtered = items.filter(item => item.type === args.type);
            }

            if (filtered.length === 0) {
                return "No files found.";
            }

            return filtered.map(item =>
                `- [${item.type}] ${item.prompt || 'No prompt'} (${new Date(item.timestamp).toLocaleString()})`
            ).join('\n');
        } catch (e: any) {
            return `Failed to list files: ${e.message}`;
        }
    },

    search_files: async (args: { query: string }) => {
        try {
            // Basic efficient search: load recent usage and filter. 
            // Ideally backend would support search.
            const items = await StorageService.loadHistory(100);
            const q = args.query.toLowerCase();

            const matches = items.filter(item =>
                (item.prompt && item.prompt.toLowerCase().includes(q)) ||
                (item.type && item.type.toLowerCase().includes(q))
            );

            if (matches.length === 0) {
                return `No files found matching query "${args.query}".`;
            }

            return matches.map(item =>
                `- [${item.type}] ${item.prompt || 'No prompt'} (${new Date(item.timestamp).toLocaleString()})`
            ).join('\n');
        } catch (e: any) {
            return `Failed to search files: ${e.message}`;
        }
    }
};
