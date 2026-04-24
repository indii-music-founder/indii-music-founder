/**
 * useMemoryQuery Hook
 *
 * React hook for querying memories across the 5-layer memory architecture.
 * Supports semantic search, filtering by layer, and tag-based lookups.
 */

import { useState, useCallback } from 'react';
import { getPersistentMemoryService } from '@/services/memory/PersistentMemoryService';
import { getMemoryIndexService } from '@/services/memory/MemoryIndexService';
import type { Memory, MemoryLayer } from '@/services/memory/PersistentMemoryService';

interface MemoryQueryOptions {
  layers?: MemoryLayer[];
  tags?: string[];
  limit?: number;
  semanticSearch?: boolean;
}

interface MemoryQueryResult {
  memories: Memory[];
  isLoading: boolean;
  error: Error | null;
  query: (searchQuery: string, options?: MemoryQueryOptions) => Promise<void>;
  clearResults: () => void;
}

export function useMemoryQuery(): MemoryQueryResult {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const query = useCallback(
    async (searchQuery: string, options: MemoryQueryOptions = {}) => {
      const {
        layers = ['session', 'core-vault'],
        limit = 10,
        semanticSearch = false
      } = options;

      setIsLoading(true);
      setError(null);

      try {
        let results: Memory[] = [];

        if (semanticSearch) {
          // Use semantic search via MemoryIndexService
          const indexService = getMemoryIndexService();
          const semanticResults = await indexService.semanticSearch(
            searchQuery,
            limit
          );
          results = semanticResults.map((sr) => sr.memory);
        } else {
          // Use keyword search via PersistentMemoryService
          const memoryService = getPersistentMemoryService();
          results = await memoryService.search(searchQuery, layers, limit);
        }

        setMemories(results);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setMemories([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

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
