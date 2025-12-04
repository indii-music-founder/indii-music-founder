import { useStore } from '@/core/store';
import { memoryService } from '@/services/agent/MemoryService';
import { AI } from '@/services/ai/AIService';

export const MemoryTools = {
    save_memory: async (args: { content: string, type?: 'fact' | 'summary' | 'rule' }) => {
        try {
            const { currentProjectId } = useStore.getState();
            await memoryService.saveMemory(currentProjectId, args.content, args.type || 'fact');
            return `Memory saved: "${args.content}"`;
        } catch (e: any) {
            return `Failed to save memory: ${e.message}`;
        }
    },
    recall_memories: async (args: { query: string }) => {
        try {
            const { currentProjectId } = useStore.getState();
            const memories = await memoryService.retrieveRelevantMemories(currentProjectId, args.query);
            return memories.length > 0 ? `Relevant Memories:\n- ${memories.join('\n- ')}` : "No relevant memories found.";
        } catch (e: any) {
            return `Failed to recall memories: ${e.message}`;
        }
    },
    read_history: async () => {
        const history = useStore.getState().agentHistory;
        return history.slice(-5).map(h => `${h.role}: ${h.text.substring(0, 50)}...`).join('\n');
    },
    verify_output: async (args: { goal: string, content: string }) => {
        try {
            const prompt = `
            CRITIQUE REQUEST:
            Goal: "${args.goal}"
            Content to Verify: "${args.content}"

            Task: Rate this content on a scale of 1-10 based on how well it meets the goal.
            If score < 7, provide specific improvements.
            Output JSON: { "score": number, "reason": "string", "pass": boolean }
            `;

            const res = await AI.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { responseMimeType: 'application/json' }
            });

            return `Verification Result: ${res.text()}`;
        } catch (e: any) {
            return `Verification failed: ${e.message}`;
        }
    }
};
