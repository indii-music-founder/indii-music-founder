import { runAgenticWorkflow } from '@/services/rag/ragService';
import { useStore } from '@/core/store';

export const KnowledgeTools = {
    search_knowledge: async (args: { query: string }) => {
        const store = useStore.getState();
        const userProfile = store.userProfile;

        if (!userProfile) {
            return "Error: User profile not loaded. Please log in.";
        }

        try {
            // We pass a simple logger for updates
            // Note: activeTrack is null for now as it's not strictly required for general knowledge queries
            const { asset } = await runAgenticWorkflow(
                args.query,
                userProfile,
                null,
                (update) => console.log(`[RAG] ${update}`),
                () => { } // Update Doc Status dummy
            );

            // Return structured data for the agent to consume
            return JSON.stringify({
                answer: asset.content,
                sources: asset.sources.map(s => ({
                    title: s.name
                }))
            });
        } catch (e: any) {
            console.error("Knowledge Tool Error:", e);
            return JSON.stringify({ error: `Failed to search knowledge base: ${e.message}` });
        }
    }
};
