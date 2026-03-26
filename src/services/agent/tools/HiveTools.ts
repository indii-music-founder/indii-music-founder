/**
 * Hive Tools — Agent-facing tools for Layer 2 (Deep Hive)
 *
 * Provides semantic search over the episodic memory graph.
 * The Deep Hive stores cross-session insights, consolidated patterns,
 * and semantically-indexed memories for intent-based retrieval.
 */

import { memoryService } from '../MemoryService';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';

export const HiveTools = {
    /**
     * Semantically search the Deep Hive for relevant cross-session memories.
     * Uses vector similarity to find memories matching the user's intent.
     */
    hive_search: wrapTool(
        'hive_search',
        async (
            args: { query: string; limit?: number },
            _context?: AgentContext,
            toolContext?: ToolExecutionContext
        ) => {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState();
            const projectId = state.currentProjectId;

            if (!projectId) {
                return toolError('No active project. Open a project first.', 'NO_PROJECT');
            }

            if (!args.query || args.query.trim().length < 2) {
                return toolError('Query must be at least 2 characters.', 'INVALID_INPUT');
            }

            try {
                const memories = await memoryService.retrieveRelevantMemories(
                    projectId,
                    args.query.trim(),
                    args.limit || 10
                );

                return {
                    query: args.query.trim(),
                    memories,
                    memoryCount: memories.length,
                    message: memories.length > 0
                        ? `Found ${memories.length} relevant memories for "${args.query}".`
                        : `No relevant memories found for "${args.query}".`,
                };
            } catch (error) {
                return toolError(`Hive search failed: ${error}`, 'SEARCH_FAILED');
            }
        }
    ),
} satisfies Record<string, AnyToolFunction>;
