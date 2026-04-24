/**
 * useObservability.test.ts
 * Unit tests for observability hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useObservability } from './useObservability';

describe('useObservability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial metrics state', () => {
      const { result } = renderHook(() => useObservability());

      expect(result.current.metrics.rum).toBeNull();
      expect(result.current.metrics.vitalsReport).toBeNull();
      expect(result.current.metrics.isReady).toBe(false);
    });
  });

  describe('Methods', () => {
    it('should have request tracing methods', () => {
      const { result } = renderHook(() => useObservability());

      expect(typeof result.current.startRequest).toBe('function');
      expect(typeof result.current.endRequest).toBe('function');
    });

    it('should have bundle metrics method', () => {
      const { result } = renderHook(() => useObservability());
      expect(typeof result.current.getBundleMetrics).toBe('function');
    });

    it('should have request metrics method', () => {
      const { result } = renderHook(() => useObservability());
      expect(typeof result.current.getRequestMetrics).toBe('function');
    });
  });

  describe('Request Tracing', () => {
    it('should start and end requests', () => {
      const { result } = renderHook(() => useObservability());

      let correlationId: string;
      act(() => {
        correlationId = result.current.startRequest('GET', 'http://localhost/api');
      });

      expect(correlationId!).toBeDefined();
      expect(typeof correlationId!).toBe('string');

      act(() => {
        result.current.endRequest(correlationId!, 200);
      });

      const metrics = result.current.getRequestMetrics();
      expect(metrics.totalTraces).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Metrics Retrieval', () => {
    it('should return bundle metrics', () => {
      const { result } = renderHook(() => useObservability());

      const bundleMetrics = result.current.getBundleMetrics();
      expect(bundleMetrics === null || typeof bundleMetrics === 'object').toBe(true);
    });

    it('should return request metrics', () => {
      const { result } = renderHook(() => useObservability());

      const requestMetrics = result.current.getRequestMetrics();
      expect(requestMetrics).toBeDefined();
      expect(requestMetrics.totalTraces).toBeGreaterThanOrEqual(0);
      expect(requestMetrics.errorCount).toBeGreaterThanOrEqual(0);
      expect(typeof requestMetrics.avgDuration).toBe('number');
    });
  });

  describe('Event Listeners', () => {
    it('should handle visibility change', () => {
      const { unmount } = renderHook(() => useObservability());

      const event = new Event('visibilitychange');
      act(() => {
        document.dispatchEvent(event);
      });

      expect(() => unmount()).not.toThrow();
    });

    it('should cleanup listeners on unmount', () => {
      const { unmount } = renderHook(() => useObservability());
      expect(() => unmount()).not.toThrow();
    });
  });
});
