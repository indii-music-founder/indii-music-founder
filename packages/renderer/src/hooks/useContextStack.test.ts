/**
 * useContextStack.test.ts
 * Unit tests for context stack hook
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContextStack } from './useContextStack';

describe('useContextStack', () => {
  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useContextStack());

      expect(result.current.currentFrame).toBeDefined();
      expect(result.current.depth).toBeGreaterThanOrEqual(0);
      expect(result.current.tokenBudgetStatus).toBeDefined();
    });
  });

  describe('Token Budget Status', () => {
    it('should report token budget', () => {
      const { result } = renderHook(() => useContextStack());

      const status = result.current.tokenBudgetStatus;
      expect(status.used).toBeGreaterThanOrEqual(0);
      expect(status.available).toBeGreaterThanOrEqual(0);
      expect(typeof status.percentageUsed).toBe('number');
      expect(typeof status.isWarning).toBe('boolean');
      expect(typeof status.isExceeded).toBe('boolean');
    });
  });

  describe('Stack Operations', () => {
    it('should have push, pop, clear methods', () => {
      const { result } = renderHook(() => useContextStack());

      expect(typeof result.current.push).toBe('function');
      expect(typeof result.current.pop).toBe('function');
      expect(typeof result.current.clear).toBe('function');
    });

    it('should push context frame', () => {
      const { result } = renderHook(() => useContextStack());
      const initialDepth = result.current.depth;

      act(() => {
        result.current.push('test-topic', { data: 'test' });
      });

      expect(result.current.depth).toBeGreaterThan(initialDepth);
    });

    it('should clear context', () => {
      const { result } = renderHook(() => useContextStack());

      act(() => {
        result.current.push('test', {});
        result.current.clear();
      });

      expect(result.current.depth).toBe(0);
      expect(result.current.currentFrame).toBeNull();
    });
  });

  describe('Context Window', () => {
    it('should build context window', () => {
      const { result } = renderHook(() => useContextStack());

      const window = result.current.buildContextWindow();
      expect(typeof window).toBe('object');
    });
  });
});
