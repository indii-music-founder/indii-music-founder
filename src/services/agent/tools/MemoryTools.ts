import { useStore } from '@/core/store';
import { memoryService } from '@/services/agent/MemoryService';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

// ============================================================================
// Types for MemoryTools
// ============================================================================

export const MemoryTools: Record<string, AnyToolFunction> = {
    save_memory: wrapTool('save_memory', async (args: { content: string; type?: 'fact' | 'summary' | 'rule' }) => {
        const { currentProjectId } = useStore.getState();
        if (!currentProjectId) {
            return toolError("No active project found to save memory to.", "PROJ_REQUIRED");
        }

        await memoryService.saveMemory(currentProjectId, args.content, args.type || 'fact');
        return {
            content: args.content,
            type: args.type || 'fact',
            message: `Memory saved: "${args.content}"`
        };
    }),

    recall_memories: wrapTool('recall_memories', async (args: { query: string }) => {
        const { currentProjectId } = useStore.getState();
        if (!currentProjectId) {
            return toolError("No active project found to recall memories from.", "PROJ_REQUIRED");
        }

        const memories = await memoryService.retrieveRelevantMemories(currentProjectId, args.query);
        return {
            memories,
            message: memories.length > 0 ? `Retrieved ${memories.length} relevant memories.` : "No relevant memories found."
        };
    }),

    read_history: wrapTool('read_history', async () => {
        const history = useStore.getState().agentHistory;
        const recentHistory = history.slice(-10); // Show a bit more than 5
        return {
            history: recentHistory.map(h => ({
                role: h.role,
                text: h.text.substring(0, 100) // Increase snippet size
            })),
            message: `Retrieved ${recentHistory.length} most recent history items.`
        };
    })
};
