/**
 * RealUserMonitoringService — Collects Core Web Vitals and browser metrics
 *
 * Tracks:
 * - Largest Contentful Paint (LCP) - loading performance
 * - First Input Delay (FID) - interactivity
 * - Cumulative Layout Shift (CLS) - visual stability
 * - First Contentful Paint (FCP) - first pixel paint
 * - Time to First Byte (TTFB) - backend responsiveness
 */

import { onCLS, onINP, onLCP, onFCP, onTTFB, Metric } from 'web-vitals';

export interface VitalMetric {
  name: string;
  value: number;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  id: string;
  navigationType: NavigationType;
}

type NavigationType = 'navigate' | 'reload' | 'back-forward' | 'back-forward-cache' | 'restore';

export interface RUMSnapshot {
  timestamp: number;
  url: string;
  userAgent: string;
  vitals: Record<string, VitalMetric>;
  sessionId: string;
  pageLoadTime: number;
}

export class RealUserMonitoringService {
  private vitals = new Map<string, VitalMetric>();
  private sessionId: string;
  private callbacks: ((snapshot: RUMSnapshot) => void)[] = [];
  private pageLoadStart = performance.now();

  constructor() {
    this.sessionId = this._generateSessionId();
    this._initializeCollectors();
  }

  private _generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private _initializeCollectors(): void {
    onLCP((metric: Metric) => this._recordMetric('LCP', metric));
    onINP((metric: Metric) => this._recordMetric('INP', metric));
    onCLS((metric: Metric) => this._recordMetric('CLS', metric));
    onFCP((metric: Metric) => this._recordMetric('FCP', metric));
    onTTFB((metric: Metric) => this._recordMetric('TTFB', metric));
  }

  private _recordMetric(name: string, metric: Metric): void {
    const vital: VitalMetric = {
      name,
      value: metric.value,
      delta: metric.delta ?? 0,
      rating: (metric.rating ?? 'needs-improvement') as 'good' | 'needs-improvement' | 'poor',
      id: metric.id,
      navigationType: (metric.navigationType ?? 'navigate') as NavigationType,
    };

    this.vitals.set(name, vital);
  }

  getMetric(name: string): VitalMetric | undefined {
    return this.vitals.get(name);
  }

  getAllMetrics(): Record<string, VitalMetric> {
    const record: Record<string, VitalMetric> = {};
    this.vitals.forEach((metric, name) => {
      record[name] = metric;
    });
    return record;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getSnapshot(): RUMSnapshot {
    return {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      vitals: this.getAllMetrics(),
      sessionId: this.sessionId,
      pageLoadTime: performance.now() - this.pageLoadStart,
    };
  }

  onMetricsReady(callback: (snapshot: RUMSnapshot) => void): void {
    this.callbacks.push(callback);
  }

  reportMetrics(): void {
    const snapshot = this.getSnapshot();
    this.callbacks.forEach(callback => callback(snapshot));
  }

  reset(): void {
    this.vitals.clear();
    this.sessionId = this._generateSessionId();
    this.pageLoadStart = performance.now();
  }
}

export const initializeRealUserMonitoring = (): RealUserMonitoringService => {
  const rum = new RealUserMonitoringService();
  window.addEventListener('beforeunload', () => rum.reportMetrics());
  return rum;
};

let rumInstance: RealUserMonitoringService | null = null;

export const getRealUserMonitoringService = (): RealUserMonitoringService => {
  if (!rumInstance) {
    rumInstance = initializeRealUserMonitoring();
  }
  return rumInstance;
};
