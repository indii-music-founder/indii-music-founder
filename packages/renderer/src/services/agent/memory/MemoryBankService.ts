import { logger } from '@/utils/logger';

export interface MemoryBankResult {
    id: string;
    memory: string;
    score?: number;
    created_at?: string;
    updated_at?: string;
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
        void userId;
        void this.redactPII(content);
        logger.warn('[MemoryBank] Mem0 browser API access is disabled; backend memory sync is not configured.');
        return [];
    }

    /**
     * Search memories for a user based on a query.
     */
    async searchMemories(userId: string, query: string, limit: number = 5): Promise<MemoryBankResult[]> {
        void userId;
        void limit;
        void this.redactPII(query);
        logger.warn('[MemoryBank] Mem0 browser API access is disabled; backend memory search is not configured.');
        return [];
    }

    /**
     * Get all memories for a user.
     */
    async getAllMemories(userId: string): Promise<MemoryBankResult[]> {
        void userId;
        logger.warn('[MemoryBank] Mem0 browser API access is disabled; backend memory listing is not configured.');
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
