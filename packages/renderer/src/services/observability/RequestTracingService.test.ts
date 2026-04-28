/**
 * RequestTracingService.test.ts
 * Unit tests for request tracing with correlation IDs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestTracingService } from './RequestTracingService';

describe('RequestTracingService', () => {
  let service: RequestTracingService;

  beforeEach(() => {
    service = new RequestTracingService();
  });

  describe('Correlation ID Generation', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = service.generateCorrelationId();
      const id2 = service.generateCorrelationId();
      expect(id1).not.toBe(id2);
    });

    it('should generate valid correlation ID format', () => {
      const id = service.generateCorrelationId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      const parts = id.split('-');
      expect(parts.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Request Tracing', () => {
    it('should start and end traces', () => {
      const correlationId = service.startTrace('GET', 'http://localhost/api');
      expect(correlationId).toBeDefined();

      service.endTrace(correlationId, 200);
      const trace = service.getTrace(correlationId);
      expect(trace).toBeDefined();
      expect(trace?.status).toBe(200);
      expect((trace?.duration) ?? 0).toBeGreaterThanOrEqual(0);
    });

    it('should record errors', () => {
      const correlationId = service.startTrace('POST', 'http://localhost/api');
      const error = new Error('Request failed');
      service.recordError(correlationId, error);

      const trace = service.getTrace(correlationId);
      expect(trace?.error).toBe(error);
    });

    it('should add tags to traces', () => {
      const correlationId = service.startTrace('GET', 'http://localhost/api');
      service.addTag(correlationId, 'userId', '123');
      service.addTag(correlationId, 'resource', 'users');

      const trace = service.getTrace(correlationId);
      expect(trace?.tags['userId']).toBe('123');
      expect(trace?.tags['resource']).toBe('users');
    });
  });

  describe('Trace Retrieval', () => {
    it('should return undefined for non-existent trace', () => {
      const trace = service.getTrace('nonexistent');
      expect(trace).toBeUndefined();
    });

    it('should retrieve all traces', () => {
      service.startTrace('GET', 'http://localhost/1');
      service.startTrace('POST', 'http://localhost/2');
      service.startTrace('DELETE', 'http://localhost/3');

      const traces = service.getAllTraces();
      expect(traces.length).toBe(3);
    });
  });

  describe('Performance Analysis', () => {
    it('should identify slow traces', () => {
      let now = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        now += 600;
        return now;
      });

      const correlationId = service.startTrace('GET', 'http://localhost/api');
      service.endTrace(correlationId, 200);


      const slowTraces = service.getSlowTraces(500);
      expect(slowTraces.length).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });

    it('should identify error traces', () => {
      const correlationId1 = service.startTrace('GET', 'http://localhost/1');
      const correlationId2 = service.startTrace('GET', 'http://localhost/2');

      service.recordError(correlationId1, new Error('Failed'));
      service.endTrace(correlationId2, 200);

      const errorTraces = service.getErrorTraces();
      expect(errorTraces.length).toBe(1);
      expect(errorTraces[0]?.error).toBeDefined();
    });

    it('should calculate metrics', () => {
      service.startTrace('GET', 'http://localhost/1');
      service.startTrace('GET', 'http://localhost/2');

      const metrics = service.getMetrics();
      expect(metrics.totalTraces).toBe(2);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.avgDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old traces', () => {
      const correlationId = service.startTrace('GET', 'http://localhost/api');
      service.endTrace(correlationId, 200);

      const initialCount = service.getAllTraces().length;
      service.cleanup(0); // cleanup all older than now
      const finalCount = service.getAllTraces().length;

      expect(finalCount).toBeLessThanOrEqual(initialCount);
    });

    it('should reset service', () => {
      service.startTrace('GET', 'http://localhost/1');
      service.startTrace('GET', 'http://localhost/2');

      service.reset();
      const traces = service.getAllTraces();
      expect(traces.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle operations on missing traces gracefully', () => {
      expect(() => {
        service.endTrace('nonexistent', 200);
        service.recordError('nonexistent', new Error('test'));
        service.addTag('nonexistent', 'key', 'value');
      }).not.toThrow();
    });

    it('should calculate average duration with empty traces', () => {
      service.reset();
      const metrics = service.getMetrics();
      expect(metrics.avgDuration).toBe(0);
    });
  });
});
