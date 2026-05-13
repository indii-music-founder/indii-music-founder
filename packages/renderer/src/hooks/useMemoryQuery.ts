import { useState, useCallback } from 'react';
import { alwaysOnMemoryEngine } from '@/services/agent/memory/AlwaysOnMemoryEngine';
import { logger } from '@/utils/logger';

export function useMemoryQuery() {
    const [memories, setMemories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const query = useCallback(async (text: string, limit: number = 5) => {
        setIsLoading(true);
        setError(null);
        try {
            const results = await alwaysOnMemoryEngine.retrieve({ query: text, limit });
            setMemories(results);
            return results;
        } catch (err: any) {
            const msg = err.message || 'Failed to query memories';
            setError(msg);
            logger.error('[useMemoryQuery] Error:', err);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearResults = useCallback(() => {
        setMemories([]);
        setError(null);
    }, []);

    return {
        memories,
        isLoading,
        error,
        query,
        clearResults
    };
}
