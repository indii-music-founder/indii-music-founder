/**
 * MemoryIndexService.test.ts
 * Unit tests for RAG semantic search
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryIndexService } from './MemoryIndexService';

describe('MemoryIndexService', () => {
  let service: MemoryIndexService;

  beforeEach(() => {
    service = new MemoryIndexService();
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('Index Statistics', () => {
    it('should return stats with empty index', () => {
      const stats = service.getStats();
      expect(stats.totalIndexed).toBe(0);
      expect(stats.similarity_threshold).toBe(0.65);
      expect(stats.initialized).toBeDefined();
    });
  });

  describe('Index Clearing', () => {
    it('should clear index without errors', () => {
      expect(() => service.clearIndex()).not.toThrow();
      expect(service.getStats().totalIndexed).toBe(0);
    });
  });

  describe('Semantic Search', () => {
    it('should return empty results for unindexed memories', async () => {
      const results = await service.semanticSearch('test query');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });
});
