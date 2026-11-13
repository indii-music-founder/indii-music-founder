
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext, ToolFunctionResult } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';
import { logger } from '@/utils/logger';
import { alwaysOnMemoryEngine, type MemoryIngestReceipt } from '../memory/AlwaysOnMemoryEngine';
import type { AlwaysOnMemoryCategory } from '@/types/AlwaysOnMemory';
import { importWithRetry } from '@/utils/dynamicImport';

function memoryWriteFailure(toolName: string, message: string, code: 'MEMORY_SAVE_UNCONFIRMED' | 'MEMORY_NOT_SAVED' = 'MEMORY_SAVE_UNCONFIRMED'): ToolFunctionResult {
    return toolError(message, code, { retryable: false, toolName });
}

function memoryReceiptResult(toolName: string, receipt: MemoryIngestReceipt, data: Record<string, unknown> = {}): ToolFunctionResult {
    if (receipt.status !== 'stored') {
        return memoryWriteFailure(toolName, receipt.status === 'skipped'
            ? `No new memory was saved: ${receipt.reason}.`
            : 'Memory save could not be confirmed. Check memory before retrying to avoid a duplicate.', receipt.status === 'skipped' ? 'MEMORY_NOT_SAVED' : 'MEMORY_SAVE_UNCONFIRMED');
    }
    const message = `Memory saved. Reference: ${receipt.memoryId}.`;
    return toolSuccess({ ...data, ...receipt }, message, { durableReceipt: true, receiptText: message });
}

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
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const projectId = toolContext?.get('currentProjectId') || useStore.getState().currentProjectId;

        try {
            // Map legacy types
            const categoryMap: Record<string, AlwaysOnMemoryCategory> = {
                'fact': 'fact',
                'summary': 'summary',
                'rule': 'preference',
                'preference': 'preference'
            };

            const result = await alwaysOnMemoryEngine.ingestWithReceipt(
                args.content,
                'agent_extraction',
                categoryMap[args.type || 'fact'] || 'fact'
            );

            return memoryReceiptResult('save_memory', result, { content: args.content, projectId });
        } catch (e: unknown) {
            logger.error('[MemoryTools] save_memory failed:', e);
            return memoryWriteFailure('save_memory', 'Memory save could not be confirmed. Check memory before retrying to avoid a duplicate.');
        }
    }),

    recall_memories: wrapTool('recall_memories', async (args: { query: string }, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
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

    index_memory: wrapTool('index_memory', async (args: { content: string }, _context?: AgentContext, _toolContext?: ToolExecutionContext) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const userId = useStore.getState().user?.uid;
        
        if (!userId) {
            return memoryWriteFailure('index_memory', 'Sign in before saving semantic memory. No memory was saved.', 'MEMORY_NOT_SAVED');
        }

        try {
            const { memoryBankService } = await importWithRetry(() => import('../memory/MemoryBankService'));
            const result = await memoryBankService.addMemory(userId, args.content);
            if (!result.length) return memoryWriteFailure('index_memory', 'Semantic memory save could not be confirmed. Check memory before retrying.');
            return toolSuccess({ results: result }, `Semantic memory saved. Reference: ${result.map(item => item.id).join(', ')}.`);
        } catch (e: unknown) {
            logger.error('[MemoryTools] index_memory failed:', e);
            return memoryWriteFailure('index_memory', 'Semantic memory save could not be confirmed. Check memory before retrying to avoid a duplicate.');
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
            const receipt = await alwaysOnMemoryEngine.ingestWithReceipt(
                args.content,
                'user_input',
                args.category
            );
            return memoryReceiptResult('save_user_memory', receipt);
        } catch {
            return memoryWriteFailure('save_user_memory', 'Memory save could not be confirmed. Check memory before retrying to avoid a duplicate.');
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            return toolError(`Failed to list memories: ${error.message}`, 'LIST_ERROR');
        }
    }),

    consolidate_user_memories: wrapTool('consolidate_user_memories', async () => {
        try {
            const result = await alwaysOnMemoryEngine.consolidateNow();
            return toolSuccess({ result }, `Consolidation complete.`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            return toolError(`Consolidation failed: ${error.message}`, 'CONSOLIDATE_ERROR');
        }
    })
} satisfies Record<string, AnyToolFunction>;
