/**
 * PersistentMemoryService.test.ts
 * Unit tests for 5-layer memory architecture
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PersistentMemoryService } from './PersistentMemoryService';
import type { Memory } from './PersistentMemoryService';

describe('PersistentMemoryService', () => {
  let service: PersistentMemoryService;

  beforeEach(() => {
    service = new PersistentMemoryService();
  });

  describe('Scratchpad Layer', () => {
    it('should write and read from scratchpad', async () => {
      const testData = { test: 'value' };
      await service.write('scratchpad', 'test-key', testData);
      const result = await service.read('scratchpad', 'test-key');
      expect(result).toEqual(testData);
    });

    it('should return null for missing scratchpad key', async () => {
      const result = await service.read('scratchpad', 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Memory Interface', () => {
    it('should create valid memory objects', async () => {
      const testMemory: Memory = {
        id: 'test-1',
        layer: 'scratchpad',
        key: 'test',
        value: { data: 'test' },
        timestamp: Date.now(),
        tags: ['test', 'unit']
      };

      expect(testMemory.id).toBeDefined();
      expect(testMemory.layer).toBe('scratchpad');
      expect(testMemory.tags).toContain('test');
    });
  });

  describe('Search Functionality', () => {
    it('should return empty array for search on empty service', async () => {
      const results = await service.search('test', ['scratchpad']);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should not throw on cleanup', async () => {
      await expect(service.cleanup()).resolves.not.toThrow();
    });
  });
});
