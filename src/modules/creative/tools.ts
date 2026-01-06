
import { StorageService } from '@/services/StorageService';
import { HistoryItem } from '@/core/store';

/**
 * Creative Studio Tools
 * Allows agents to access and utilize generated/uploaded assets.
 */

export const CREATIVE_TOOLS = {
    get_studio_assets: async (args: {
        query?: string,
        limit?: number,
        type?: 'image' | 'video'
    }) => {
        try {
            // Load history from storage (which handles org/user context)
            const assets = await StorageService.loadHistory(args.limit || 20);

            let filtered = assets;

            // Apply filters
            if (args.type) {
                filtered = filtered.filter(item => item.type === args.type);
            }

            if (args.query) {
                const q = args.query.toLowerCase();
                filtered = filtered.filter(item =>
                    item.prompt?.toLowerCase().includes(q) ||
                    item.tags?.some(t => t.toLowerCase().includes(q))
                );
            }

            // Map to a lightweight format for the agent
            const simplified = filtered.map(item => ({
                id: item.id,
                type: item.type,
                description: item.prompt || "No description",
                url: item.url,
                timestamp: new Date(item.timestamp).toISOString()
            }));

            if (simplified.length === 0) {
                return "No matching assets found in Creative Studio history.";
            }

            return JSON.stringify(simplified, null, 2);
        } catch (e) {
            console.error('CREATIVE_TOOLS.get_studio_assets error:', e);
            return "Error retrieving studio assets.";
        }
    }
};
