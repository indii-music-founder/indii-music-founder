import { runAgenticWorkflow } from '@/services/rag/ragService';
import { useStore } from '@/core/store';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const KnowledgeTools: Record<string, AnyToolFunction> = {
    search_knowledge: wrapTool('search_knowledge', async (args: { query: string }) => {
        const store = useStore.getState();
        const userProfile = store.userProfile;

        if (!userProfile) {
            return toolError("User profile not loaded. Please log in.", "AUTH_REQUIRED");
        }

        // We pass a simple logger for updates
        // Note: activeTrack is null for now as it's not strictly required for general knowledge queries
        const { asset } = await runAgenticWorkflow(
            args.query,
            userProfile,
            null,
            (update) => console.info(`[RAG] ${update}`),
            () => { } // Update Doc Status dummy
        );

        // Return structured data for the agent to consume
        return {
            answer: asset.content,
            sources: asset.sources.map(s => ({
                title: s.name
            })),
            message: "Knowledge search completed successfully."
        };
    })
};
