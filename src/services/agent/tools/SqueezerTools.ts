/**
 * Squeezer Tools — Agent-facing tools for Layer 1 (Memory Squeezer)
 *
 * Provides search and expand operations on past session transcripts.
 * The Squeezer holds compressed session memory that can be
 * re-expanded on demand for cross-session continuity.
 */

import { HistoryManager } from '../components/HistoryManager';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';

const historyManager = new HistoryManager();

export const SqueezerTools = {
    /**
     * Search past session transcripts by keyword.
     * Returns matching snippets from prior conversations.
     */
    squeezer_search: wrapTool(
        'squeezer_search',
        async (
            args: { query: string; limit?: number },
            _context?: AgentContext,
            toolContext?: ToolExecutionContext
        ) => {
            const { useStore } = await import('@/core/store');
            const userId = toolContext
                ? toolContext.get('user')?.uid
                : useStore.getState().user?.uid;

            if (!userId) {
                return toolError('User not authenticated.', 'AUTH_REQUIRED');
            }

            if (!args.query || args.query.trim().length < 2) {
                return toolError('Query must be at least 2 characters.', 'INVALID_INPUT');
            }

            try {
                const results = await historyManager.searchTranscripts(
                    userId,
                    args.query.trim(),
                    args.limit || 5
                );

                return {
                    query: args.query.trim(),
                    results,
                    resultCount: results.length,
                    message: results.length > 0
                        ? `Found ${results.length} matching transcripts for "${args.query}".`
                        : `No matching transcripts found for "${args.query}".`,
                };
            } catch (error) {
                return toolError(`Transcript search failed: ${error}`, 'SEARCH_FAILED');
            }
        }
    ),

    /**
     * Get the full current session's compiled view (summary + recent).
     * Useful for the agent to review what has already been discussed.
     */
    squeezer_expand: wrapTool(
        'squeezer_expand',
        async (
            _args: Record<string, never>,
            _context?: AgentContext,
            _toolContext?: ToolExecutionContext
        ) => {
            try {
                const compiledView = await historyManager.getCompiledView();

                return {
                    transcript: compiledView,
                    characterCount: compiledView.length,
                    message: compiledView
                        ? `Retrieved current session transcript (${compiledView.length} chars).`
                        : 'No session history available yet.',
                };
            } catch (error) {
                return toolError(`Failed to expand transcript: ${error}`, 'EXPAND_FAILED');
            }
        }
    ),
} satisfies Record<string, AnyToolFunction>;
