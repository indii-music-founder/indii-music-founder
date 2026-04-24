/**
 * useAgentStream.test.ts
 * Unit tests for agent streaming hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentStream } from './useAgentStream';

describe('useAgentStream', () => {
  const mockUserId = 'test-user-123';

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAgentStream(mockUserId));

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.tokens).toEqual([]);
      expect(result.current.fullText).toBe('');
      expect(result.current.error).toBeNull();
      expect(result.current.tokenCount).toBe(0);
    });
  });

  describe('Stream Methods', () => {
    it('should have stream method', () => {
      const { result } = renderHook(() => useAgentStream(mockUserId));
      expect(typeof result.current.stream).toBe('function');
    });

    it('should have stop method', () => {
      const { result } = renderHook(() => useAgentStream(mockUserId));
      expect(typeof result.current.stop).toBe('function');
    });

    it('should have reset method', () => {
      const { result } = renderHook(() => useAgentStream(mockUserId));
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset state', () => {
      const { result } = renderHook(() => useAgentStream(mockUserId));

      act(() => {
        result.current.reset();
      });

      expect(result.current.tokens).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('Token Tracking', () => {
    it('should track token count', () => {
      const { result } = renderHook(() => useAgentStream(mockUserId));
      expect(result.current.tokenCount).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should handle unmount cleanup', () => {
      const { unmount } = renderHook(() => useAgentStream(mockUserId));
      expect(() => unmount()).not.toThrow();
    });
  });
});
