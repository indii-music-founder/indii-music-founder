/**
 * MemoryIndexService
 *
 * Semantic search indexing for the RAG layer.
 * Generates embeddings for memory items and supports semantic similarity search.
 *
 * Integration: Works alongside PersistentMemoryService
 * Uses: Google Generative AI embeddings API
 */

import { logger } from '@/utils/logger';
import { GoogleGenAI } from '@google/genai';
import type { Memory, MemoryLayer } from './PersistentMemoryService';

interface EmbeddingIndex {
  memoryId: string;
  layer: MemoryLayer;
  key: string;
  embedding: number[];
  content: string;
  timestamp: number;
}

interface SearchResult {
  memory: Memory;
  similarity: number;
  relevanceScore: number;
}

export class MemoryIndexService {
  private genAI: GoogleGenAI | null = null;
  private embeddings: Map<string, EmbeddingIndex> = new Map();
  private similarityThreshold = 0.65;
  private initialized = false;

  async initialize(): Promise<void> {
    try {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (!apiKey) {
        throw new Error('VITE_API_KEY not configured');
      }

      this.genAI = new GoogleGenAI({ apiKey });
      this.initialized = true;
      logger.info('[MemoryIndex] Initialized with Google Generative AI');
    } catch (error) {
      logger.error('[MemoryIndex] Initialization failed', error);
    }
  }

  /**
   * Generate embedding for a text string
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      if (!this.genAI || !this.initialized) {
        await this.initialize();
      }

      if (!this.genAI) {
        throw new Error('GenAI not initialized');
      }

      const result = await this.genAI.models.embedContent({
        model: 'models/embedding-001',
        contents: text
      });

      const values = result.embeddings?.[0]?.values;
      return values || null;
    } catch (error) {
      logger.error('[MemoryIndex] Failed to generate embedding', error);
      return null;
    }
  }

  /**
   * Index a memory item with embeddings
   */
  async indexMemory(memory: Memory): Promise<void> {
    try {
      const content = this.serializeMemory(memory);
      const embedding = await this.generateEmbedding(content);

      if (!embedding) {
        logger.warn(`[MemoryIndex] Could not embed memory ${memory.id}`);
        return;
      }

      const index: EmbeddingIndex = {
        memoryId: memory.id,
        layer: memory.layer,
        key: memory.key,
        embedding,
        content,
        timestamp: Date.now()
      };

      this.embeddings.set(memory.id, index);
      logger.debug(`[MemoryIndex] Indexed memory ${memory.id}`);
    } catch (error) {
      logger.error('[MemoryIndex] Indexing failed', error);
    }
  }

  /**
   * Remove memory from index
   */
  removeMemory(memoryId: string): void {
    this.embeddings.delete(memoryId);
  }

  /**
   * Semantic search across indexed memories
   */
  async semanticSearch(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      if (this.embeddings.size === 0) {
        logger.debug('[MemoryIndex] No indexed memories');
        return [];
      }

      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        logger.warn('[MemoryIndex] Failed to embed query');
        return [];
      }

      const similarities = Array.from(this.embeddings.values()).map((index) => ({
        index,
        similarity: this.cosineSimilarity(queryEmbedding, index.embedding)
      }));

      return similarities
        .filter((result) => result.similarity >= this.similarityThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map((result) => ({
          memory: {
            id: result.index.memoryId,
            layer: result.index.layer,
            key: result.index.key,
            value: { indexed: true },
            timestamp: result.index.timestamp,
            tags: []
          },
          similarity: result.similarity,
          relevanceScore: this.computeRelevance(result.similarity)
        }));
    } catch (error) {
      logger.error('[MemoryIndex] Search failed', error);
      return [];
    }
  }

  /**
   * Batch index multiple memories
   */
  async batchIndex(memories: Memory[]): Promise<void> {
    const promises = memories.map((memory) => this.indexMemory(memory));
    await Promise.all(promises);
  }

  /**
   * Get index stats
   */
  getStats() {
    return {
      totalIndexed: this.embeddings.size,
      similarity_threshold: this.similarityThreshold,
      initialized: this.initialized
    };
  }

  /**
   * Clear all indexes
   */
  clearIndex(): void {
    this.embeddings.clear();
    logger.debug('[MemoryIndex] Index cleared');
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private serializeMemory(memory: Memory): string {
    return `Key: ${memory.key}
Value: ${JSON.stringify(memory.value)}
Tags: ${memory.tags.join(', ')}
Layer: ${memory.layer}`;
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

    const dotProduct = vec1.reduce((sum, val, i) => sum + val * (vec2[i] ?? 0), 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (mag1 * mag2);
  }

  private computeRelevance(similarity: number): number {
    return Math.min(1, Math.max(0, (similarity - this.similarityThreshold) / (1 - this.similarityThreshold)));
  }
}

// ============================================================================
// Singleton
// ============================================================================

let memoryIndexService: MemoryIndexService | null = null;

export async function initializeMemoryIndexService(): Promise<MemoryIndexService> {
  if (!memoryIndexService) {
    memoryIndexService = new MemoryIndexService();
    await memoryIndexService.initialize();
  }
  return memoryIndexService;
}

export function getMemoryIndexService(): MemoryIndexService {
  if (!memoryIndexService) {
    throw new Error('MemoryIndexService not initialized');
  }
  return memoryIndexService;
}
