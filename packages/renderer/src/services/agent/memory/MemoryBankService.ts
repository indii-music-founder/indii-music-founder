import { logger } from '@/utils/logger';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

export interface MemoryBankResult {
    id: string;
    memory: string;
    score?: number;
    created_at?: string;
    updated_at?: string;
}

export interface MemorySearchResponse {
    results: MemoryBankResult[];
    hasMore: boolean;
}

/**
 * MemoryBankService — Bridge to GEAP's managed Memory Bank (Mem0).
 * Handles persistent long-term and episodic memory via vector search.
 *
 * Browser-side Mem0 API token usage is disabled. Any future Mem0 integration
 * must be routed through an authenticated Firebase Callable/HTTP backend.
 */
class MemoryBankService {
    /**
     * Redacts PII like credit card numbers and passwords/secrets from the text.
     */
    private redactPII(text: string): string {
        // Redact credit cards (Luhn-like 13-16 digits grouped or contiguous)
        let redacted = text.replace(
            /\b(?:\d[ -]*?){13,16}\b/g,
            '[REDACTED_CREDIT_CARD]'
        );
        // Redact common password patterns (e.g. password: value, pass: value, secret: value, etc.)
        redacted = redacted.replace(
            /(password|passwd|pass|secret|apiKey|api_key|client_secret|clientSecret)\s*([:=])\s*(['"]?)([^\s'"&?]{4,})\3/gi,
            '$1$2$3[REDACTED_SECRET]$3'
        );
        return redacted;
    }

    /**
     * Add a new memory for a user.
     */
    async addMemory(userId: string, content: string): Promise<MemoryBankResult[]> {
        const redactedContent = this.redactPII(content);
        try {
            const callable = httpsCallable<{ action: string; memory: string }, { results: MemoryBankResult[] }>(functions, 'manageSemanticMemory');
            const result = await callable({ action: 'add', memory: redactedContent });
            return result.data.results || [];
        } catch (error) {
            logger.error('[MemoryBank] Failed to add memory via manageSemanticMemory proxy', error);
            return [];
        }
    }

    /**
     * Search memories for a user based on a query (single page).
     * @returns { results, hasMore } for pagination support
     */
    async searchMemories(userId: string, query: string, limit: number = 100): Promise<MemorySearchResponse> {
        const redactedQuery = this.redactPII(query);
        try {
            const callable = httpsCallable<
                { action: string; query: string; limit: number },
                { results: MemoryBankResult[]; hasMore: boolean }
            >(functions, 'manageSemanticMemory');
            const result = await callable({ action: 'search', query: redactedQuery, limit });
            return { results: result.data.results || [], hasMore: result.data.hasMore ?? false };
        } catch (error) {
            logger.error('[MemoryBank] Failed to search memories via manageSemanticMemory proxy', error);
            return { results: [], hasMore: false };
        }
    }

    /** The backend exposes one ranked vector page and no continuation cursor. */
    async searchMemoriesScoped(
        userId: string,
        query: string,
    ): Promise<{ results: MemoryBankResult[]; hasMore: boolean; scopeMessage: string }> {
        const response = await this.searchMemories(userId, query, 100);
        const results = [...new Map(response.results.map(result => [result.id, result])).values()];
        const scopeMessage = `Searched the first ranked memory page; found ${results.length} unique item(s).` +
            (response.hasMore ? ' More matches may exist beyond this page.' : ' No further matches were reported.');
        return { results, hasMore: response.hasMore, scopeMessage };
    }

    /**
     * Get all memories for a user.
     */
    async getAllMemories(userId: string): Promise<MemoryBankResult[]> {
        void userId;
        logger.warn('[MemoryBank] getAllMemories is not supported by manageSemanticMemory proxy yet.');
        return [];
    }

    /**
     * Indexes a completed graph execution as a long-term episodic memory.
     */
    async indexGraphExecution(userId: string, executionId: string, query: string, report: string): Promise<void> {
        try {
            const content = `[Graph Execution ${executionId}]\nQuery: ${query}\nFinal Report: ${report}`;
            const results = await this.addMemory(userId, content);
            if (results && results.length > 0) {
                logger.info(`[MemoryBank] Indexed graph execution ${executionId}`);
            } else {
                logger.warn(`[MemoryBank] Failed to index graph execution ${executionId} (addMemory returned no results)`);
            }
        } catch (error) {
            logger.error(`[MemoryBank] Failed to index graph ${executionId}:`, error);
        }
    }
}

export const memoryBankService = new MemoryBankService();
