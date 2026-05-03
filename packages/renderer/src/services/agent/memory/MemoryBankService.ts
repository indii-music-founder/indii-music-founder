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
 */
class MemoryBankService {
    private apiKey: string;
    private baseUrl = 'https://api.mem0.ai/v2/memories/';

    constructor() {
        this.apiKey = import.meta.env.VITE_MEM0_API_KEY || import.meta.env.MEM0_API_KEY || '';
        if (!this.apiKey) {
            logger.warn('[MemoryBank] MEM0_API_KEY is not set in environment.');
        }
    }

    private get headers() {
        return {
            'Authorization': `Token ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Add a new memory for a user.
     */
    async addMemory(userId: string, content: string): Promise<MemoryBankResult[]> {
        if (!this.apiKey) return [];

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    messages: [{ role: 'user', content }],
                    user_id: userId,
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                logger.error(`[MemoryBank] Failed to add memory: ${err}`);
                return [];
            }

            const data = await response.json();
            return data as MemoryBankResult[];
        } catch (error) {
            logger.error('[MemoryBank] Error adding memory:', error);
            return [];
        }
    }

    /**
     * Search memories for a user based on a query.
     */
    async searchMemories(userId: string, query: string, limit: number = 5): Promise<MemoryBankResult[]> {
        if (!this.apiKey) return [];

        try {
            const response = await fetch(`${this.baseUrl}search/`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    query,
                    user_id: userId,
                    limit,
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                logger.error(`[MemoryBank] Failed to search memories: ${err}`);
                return [];
            }

            const data = await response.json();
            return data as MemoryBankResult[];
        } catch (error) {
            logger.error('[MemoryBank] Error searching memories:', error);
            return [];
        }
    }

    /**
     * Get all memories for a user.
     */
    async getAllMemories(userId: string): Promise<MemoryBankResult[]> {
        if (!this.apiKey) return [];

        try {
            const response = await fetch(`${this.baseUrl}?user_id=${userId}`, {
                method: 'GET',
                headers: this.headers,
            });

            if (!response.ok) {
                const err = await response.text();
                logger.error(`[MemoryBank] Failed to get memories: ${err}`);
                return [];
            }

            const data = await response.json();
            return data as MemoryBankResult[];
        } catch (error) {
            logger.error('[MemoryBank] Error getting memories:', error);
            return [];
        }
    }

    /**
     * Indexes a completed graph execution as a long-term episodic memory.
     */
    async indexGraphExecution(userId: string, executionId: string, query: string, report: string): Promise<void> {
        if (!this.apiKey) return;

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
