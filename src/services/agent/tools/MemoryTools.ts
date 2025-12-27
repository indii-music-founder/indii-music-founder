import { useStore } from '@/core/store';
import { memoryService } from '@/services/agent/MemoryService';
import type { ToolFunctionArgs } from '../types';

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
    }
};
