
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';
import { logger } from '@/utils/logger';
import { alwaysOnMemoryEngine } from '../memory/AlwaysOnMemoryEngine';
import type { AlwaysOnMemoryCategory } from '@/types/AlwaysOnMemory';

/**
 * MemoryTools - Unified tools for interacting with the Always-On Memory system.
 * 
 * Supports both legacy project-scoped tools and new persistent user-centric tools.
 * All operations are backed by the AlwaysOnMemoryEngine singleton (v1.63.0).
 */
export const MemoryTools = {
    // ========================================================================
    // Legacy / Project-Scoped Memory
    // ========================================================================

    save_memory: wrapTool('save_memory', async (args: { content: string; type?: 'fact' | 'summary' | 'rule' | 'preference' }, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        const projectId = toolContext?.get('currentProjectId') || useStore.getState().currentProjectId;

        try {
            // Map legacy types
            const categoryMap: Record<string, AlwaysOnMemoryCategory> = {
                'fact': 'fact',
                'summary': 'summary',
                'rule': 'preference',
                'preference': 'preference'
            };

            const result = await alwaysOnMemoryEngine.ingest(
                args.content,
                'agent_extraction',
                categoryMap[args.type || 'fact'] || 'fact'
            );

            return {
                content: args.content,
                projectId,
                engineResponse: result,
                message: `Memory stored via AlwaysOnMemoryEngine.`
            };
        } catch (e: unknown) {
            logger.error('[MemoryTools] save_memory failed:', e);
            return toolError("Failed to save memory to engine.", "ENGINE_ERROR");
        }
    }),

    recall_memories: wrapTool('recall_memories', async (args: { query: string }, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        const projectId = toolContext?.get('currentProjectId') || useStore.getState().currentProjectId;

        try {
            const result = await alwaysOnMemoryEngine.query(args.query);
            return {
                answer: result,
                projectId,
                message: "Retrieved synthesized answer from AlwaysOnMemoryEngine."
            };
        } catch (e: unknown) {
            logger.error('[MemoryTools] recall_memories failed:', e);
            return toolError("Failed to query memory engine.", "ENGINE_ERROR");
        }
    }),

    // ========================================================================
    // Persistent / User-Centric Memory (Always-On)
    // ========================================================================

    save_user_memory: wrapTool('save_user_memory', async (args: { 
        content: string; 
        category?: AlwaysOnMemoryCategory; 
        importance?: string; 
        tags?: string[] 
    }) => {
        try {
            const summary = await alwaysOnMemoryEngine.ingest(
                args.content,
                'user_input',
                args.category
            );
            return toolSuccess({ summary }, `Successfully saved to persistent memory.`);
        } catch (error: any) {
            return toolError(`Failed to save user memory: ${error.message}`, 'STORAGE_ERROR');
        }
    }),

    search_user_memory: wrapTool('search_user_memory', async (args: { 
        query: string; 
        categories?: AlwaysOnMemoryCategory[]; 
        limit?: number 
    }) => {
        try {
            const answer = await alwaysOnMemoryEngine.query(args.query);
            return toolSuccess({ answer }, `Memory search complete.`);
        } catch (error: any) {
            return toolError(`Failed to search user memory: ${error.message}`, 'QUERY_ERROR');
        }
    }),

    get_user_context: wrapTool('get_user_context', async () => {
        try {
            const status = await alwaysOnMemoryEngine.getStatus();
            // We synthesize a context summary for the agent
            const answer = await alwaysOnMemoryEngine.query("Summarize the user's primary goals, preferences, and current creative focus based on all memories.");
            return toolSuccess({ context: answer, engineStatus: status }, `User context retrieved.`);
        } catch (error: any) {
            return toolError(`Failed to get user context: ${error.message}`, 'CONTEXT_ERROR');
        }
    }),

    list_user_memories: wrapTool('list_user_memories', async (args: { 
        categories?: AlwaysOnMemoryCategory[]; 
        limit?: number 
    }) => {
        try {
            const memories = await alwaysOnMemoryEngine.getAllMemories(args.limit || 20, { 
                category: args.categories?.[0] 
            });
            return toolSuccess({ memories }, `Found ${memories.length} memories.`);
        } catch (error: any) {
            return toolError(`Failed to list memories: ${error.message}`, 'LIST_ERROR');
        }
    }),

    delete_user_memory: wrapTool('delete_user_memory', async (args: { memoryId: string }) => {
        try {
            await alwaysOnMemoryEngine.deleteMemory(args.memoryId);
            return toolSuccess({ memoryId: args.memoryId }, `Memory deleted.`);
        } catch (error: any) {
            return toolError(`Failed to delete memory: ${error.message}`, 'DELETE_ERROR');
        }
    }),

    consolidate_user_memories: wrapTool('consolidate_user_memories', async () => {
        try {
            const result = await alwaysOnMemoryEngine.consolidateNow();
            return toolSuccess({ result }, `Consolidation complete.`);
        } catch (error: any) {
            return toolError(`Consolidation failed: ${error.message}`, 'CONSOLIDATE_ERROR');
        }
    })
} satisfies Record<string, AnyToolFunction>;
