/**
 * useMemoryQuery.test.ts
 * Unit tests for memory query hook
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemoryQuery } from './useMemoryQuery';

describe('useMemoryQuery', () => {
  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useMemoryQuery());

      expect(result.current.memories).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Query Methods', () => {
    it('should have query method', () => {
      const { result } = renderHook(() => useMemoryQuery());
      expect(typeof result.current.query).toBe('function');
    });

    it('should have clearResults method', () => {
      const { result } = renderHook(() => useMemoryQuery());
      expect(typeof result.current.clearResults).toBe('function');
    });
  });

  describe('Clear Results', () => {
    it('should clear memories and error', () => {
      const { result } = renderHook(() => useMemoryQuery());

      act(() => {
        result.current.clearResults();
      });

      expect(result.current.memories).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Memory Array', () => {
    it('should handle empty memories array', () => {
      const { result } = renderHook(() => useMemoryQuery());
      expect(Array.isArray(result.current.memories)).toBe(true);
      expect(result.current.memories.length).toBe(0);
    });
  });
});
