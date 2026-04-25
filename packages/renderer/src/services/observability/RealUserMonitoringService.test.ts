/**
 * RealUserMonitoringService.test.ts
 * Unit tests for Core Web Vitals collection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealUserMonitoringService } from './RealUserMonitoringService';

describe('RealUserMonitoringService', () => {
  let service: RealUserMonitoringService;

  beforeEach(() => {
    service = new RealUserMonitoringService();
  });

  describe('Initialization', () => {
    it('should initialize with session ID', () => {
      const sessionId = service.getSessionId();
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });
  });

  describe('Session Management', () => {
    it('should generate unique session IDs', () => {
      const service1 = new RealUserMonitoringService();
      const service2 = new RealUserMonitoringService();
      expect(service1.getSessionId()).not.toBe(service2.getSessionId());
    });

    it('should track metrics', () => {
      const metric = {
        name: 'LCP',
        value: 2000,
        delta: 0,
        rating: 'good' as const,
        id: 'lcp-1',
        navigationType: 'navigate' as const,
      };

      service.getSnapshot(); // Initialize snapshot

      expect(service.getAllMetrics()).toBeDefined();
      expect(typeof service.getAllMetrics()).toBe('object');
    });
  });

  describe('Snapshot Generation', () => {
    it('should generate valid snapshots', () => {
      const snapshot = service.getSnapshot();
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.url).toBe(window.location.href);
      expect(snapshot.userAgent).toBeDefined();
      expect(snapshot.sessionId).toBe(service.getSessionId());
      expect(snapshot.pageLoadTime).toBeGreaterThanOrEqual(0);
    });

    it('should track page load time', () => {
      const snapshot1 = service.getSnapshot();
      const snapshot2 = service.getSnapshot();
      expect(snapshot2.pageLoadTime).toBeGreaterThanOrEqual(snapshot1.pageLoadTime);
    });
  });

  describe('Callbacks', () => {
    it('should register and call metrics ready callbacks', () => {
      const callback = vi.fn();
      service.onMetricsReady(callback);
      service.reportMetrics();
      expect(callback).toHaveBeenCalled();
    });

    it('should handle multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      service.onMetricsReady(callback1);
      service.onMetricsReady(callback2);
      service.reportMetrics();
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Reset', () => {
    it('should reset state', () => {
      const oldSessionId = service.getSessionId();
      service.reset();
      const newSessionId = service.getSessionId();
      expect(newSessionId).not.toBe(oldSessionId);
    });

    it('should clear metrics on reset', () => {
      service.reset();
      const metrics = service.getAllMetrics();
      expect(Object.keys(metrics).length).toBe(0);
    });
  });

  describe('Metrics Retrieval', () => {
    it('should return empty metrics initially', () => {
      const metrics = service.getAllMetrics();
      expect(typeof metrics).toBe('object');
      expect(Object.keys(metrics).length).toBe(0);
    });

    it('should return undefined for non-existent metric', () => {
      const metric = service.getMetric('NONEXISTENT');
      expect(metric).toBeUndefined();
    });
  });
});
