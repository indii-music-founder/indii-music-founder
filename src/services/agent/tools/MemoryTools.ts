import { useStore } from '@/core/store';
import { memoryService } from '@/services/agent/MemoryService';
import { AI } from '@/services/ai/AIService';
import type { ToolFunctionArgs } from '../types';
import { AI_MODELS } from '@/core/config/ai-models';

// ============================================================================
// Types for MemoryTools
// ============================================================================

interface SaveMemoryArgs extends ToolFunctionArgs {
    content: string;
    type?: 'fact' | 'summary' | 'rule';
}

interface RecallMemoriesArgs extends ToolFunctionArgs {
    query: string;
}

interface VerifyOutputArgs extends ToolFunctionArgs {
    goal: string;
    content: string;
}

// ============================================================================
// Helper to extract error message
// ============================================================================

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred';
}

// ============================================================================
// MemoryTools Implementation
// ============================================================================

export const MemoryTools = {
    save_memory: async (args: SaveMemoryArgs): Promise<string> => {
        try {
            const { currentProjectId } = useStore.getState();
            await memoryService.saveMemory(currentProjectId, args.content, args.type || 'fact');
            return `Memory saved: "${args.content}"`;
        } catch (e: unknown) {
            return `Failed to save memory: ${getErrorMessage(e)}`;
        }
    },

    recall_memories: async (args: RecallMemoriesArgs): Promise<string> => {
        try {
            const { currentProjectId } = useStore.getState();
            const memories = await memoryService.retrieveRelevantMemories(currentProjectId, args.query);
            return memories.length > 0 ? `Relevant Memories:\n- ${memories.join('\n- ')}` : "No relevant memories found.";
        } catch (e: unknown) {
            return `Failed to recall memories: ${getErrorMessage(e)}`;
        }
    },

    read_history: async (): Promise<string> => {
        const history = useStore.getState().agentHistory;
        return history.slice(-5).map(h => `${h.role}: ${h.text.substring(0, 50)}...`).join('\n');
    },

    verify_output: async (args: VerifyOutputArgs): Promise<string> => {
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
                model: AI_MODELS.TEXT.AGENT,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { responseMimeType: 'application/json' }
            });

            return `Verification Result: ${res.text()}`;
        } catch (e: unknown) {
            return `Verification failed: ${getErrorMessage(e)}`;
        }
    }
};
