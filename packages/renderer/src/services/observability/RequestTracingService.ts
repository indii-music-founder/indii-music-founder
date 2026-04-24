/**
 * RequestTracingService — Traces requests with correlation IDs
 *
 * Provides:
 * - Unique correlation ID generation per request trace
 * - Request timing and performance metrics
 * - Error tracking with trace context
 * - Distributed tracing support (correlation IDs across services)
 */

export interface RequestTrace {
  correlationId: string;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  method: string;
  url: string;
  status: number | null;
  error: Error | null;
  tags: Record<string, string>;
}

export class RequestTracingService {
  private traces = new Map<string, RequestTrace>();
  private correlationIdCounter = 0;

  generateCorrelationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const counter = ++this.correlationIdCounter;
    return `${timestamp}-${counter}-${random}`;
  }

  startTrace(method: string, url: string): string {
    const correlationId = this.generateCorrelationId();
    const trace: RequestTrace = {
      correlationId,
      startTime: performance.now(),
      endTime: null,
      duration: null,
      method,
      url,
      status: null,
      error: null,
      tags: {},
    };
    this.traces.set(correlationId, trace);
    return correlationId;
  }

  endTrace(correlationId: string, status: number): void {
    const trace = this.traces.get(correlationId);
    if (!trace) return;

    trace.endTime = performance.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = status;
  }

  recordError(correlationId: string, error: Error): void {
    const trace = this.traces.get(correlationId);
    if (!trace) return;

    trace.error = error;
    if (!trace.endTime) {
      trace.endTime = performance.now();
      trace.duration = trace.endTime - trace.startTime;
    }
  }

  addTag(correlationId: string, key: string, value: string): void {
    const trace = this.traces.get(correlationId);
    if (!trace) return;
    trace.tags[key] = value;
  }

  getTrace(correlationId: string): RequestTrace | undefined {
    return this.traces.get(correlationId);
  }

  getAllTraces(): RequestTrace[] {
    return Array.from(this.traces.values());
  }

  getSlowTraces(threshold: number): RequestTrace[] {
    return this.getAllTraces().filter(trace => (trace.duration ?? 0) > threshold);
  }

  getErrorTraces(): RequestTrace[] {
    return this.getAllTraces().filter(trace => trace.error !== null);
  }

  cleanup(olderThanMs: number = 3600000): void { // 1 hour default
    const cutoff = performance.now() - olderThanMs;
    const toDelete: string[] = [];

    this.traces.forEach((trace, id) => {
      if ((trace.endTime ?? trace.startTime) < cutoff) {
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => this.traces.delete(id));
  }

  reset(): void {
    this.traces.clear();
    this.correlationIdCounter = 0;
  }

  getMetrics(): { totalTraces: number; errorCount: number; avgDuration: number } {
    const traces = this.getAllTraces();
    const errorCount = this.getErrorTraces().length;
    const completedTraces = traces.filter(t => t.duration !== null);
    const avgDuration = completedTraces.length > 0
      ? completedTraces.reduce((sum, t) => sum + (t.duration ?? 0), 0) / completedTraces.length
      : 0;

    return {
      totalTraces: traces.length,
      errorCount,
      avgDuration,
    };
  }
}

let tracingInstance: RequestTracingService | null = null;

export const getRequestTracingService = (): RequestTracingService => {
  if (!tracingInstance) {
    tracingInstance = new RequestTracingService();
  }
  return tracingInstance;
};

// Automatically cleanup old traces every 5 minutes
setInterval(() => {
  if (tracingInstance) {
    tracingInstance.cleanup();
  }
}, 5 * 60 * 1000);
