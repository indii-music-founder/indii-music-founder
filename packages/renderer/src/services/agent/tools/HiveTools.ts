/**
 * Hive Tools — Agent-facing tools for Layer 2 (Deep Hive)
 *
 * Provides semantic search over the episodic memory graph.
 * The Deep Hive stores cross-session insights, consolidated patterns,
 * and semantically-indexed memories for intent-based retrieval.
 */

import { alwaysOnMemoryEngine } from '../memory/AlwaysOnMemoryEngine';
import { logger } from '@/utils/logger';
import { wrapTool } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const HiveTools = {
    /**
     * Search the 'Hive Mind' (Shared Memory) for relevant context.
     */
    search_hive: wrapTool('search_hive', async (args: { query: string, limit?: number }) => {
        const { query, limit = 5 } = args;
        try {
            const results = await alwaysOnMemoryEngine.retrieve({ query, limit: limit || 5 });
            
            if (results.length === 0) {
                return 'No relevant shared context found in the Hive.';
            }

            return `Hive Results:\n${results.map(r => `- [${r.category}] ${r.summary || r.content}`).join('\n')}`;
        } catch (error: unknown) {
            logger.error('[HiveTools] Search failed:', error);
            throw error;
        }
    })
} satisfies Record<string, AnyToolFunction>;
