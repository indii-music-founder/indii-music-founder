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

            // Format the output for the LLM
            const sourceList = asset.sources.map(s => `- ${s.name}`).join('\n');

            return `Answer based on Knowledge Base:\n${asset.content}\n\nSources:\n${sourceList}`;
        } catch (e: any) {
            console.error("Knowledge Tool Error:", e);
            return `Failed to search knowledge base: ${e.message}`;
        }
    }
};
