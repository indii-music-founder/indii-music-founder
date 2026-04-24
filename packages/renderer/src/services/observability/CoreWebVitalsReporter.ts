/**
 * CoreWebVitalsReporter — Analyzes and reports Core Web Vitals thresholds
 *
 * Good thresholds (p75):
 * - LCP (Largest Contentful Paint): ≤ 2500ms
 * - INP (Interaction to Next Paint): ≤ 200ms (replaced FID in web-vitals v5)
 * - CLS (Cumulative Layout Shift): ≤ 0.1
 * - FCP (First Contentful Paint): ≤ 1800ms
 * - TTFB (Time to First Byte): ≤ 600ms
 *
 * Reference: https://web.dev/articles/vitals
 */

import type { VitalMetric, RUMSnapshot } from './RealUserMonitoringService';

export interface VitalStatus {
  metric: string;
  value: number;
  threshold: number;
  status: 'good' | 'needs-improvement' | 'poor';
  percentOfThreshold: number;
}

export interface VitalsReport {
  timestamp: number;
  sessionId: string;
  vitals: VitalStatus[];
  overallStatus: 'good' | 'needs-improvement' | 'poor';
  failingCount: number;
  warnings: string[];
}

export class CoreWebVitalsReporter {
  private static readonly THRESHOLDS: Record<string, number> = {
    LCP: 2500,
    INP: 200,
    CLS: 0.1,
    FCP: 1800,
    TTFB: 600,
  };

  private static readonly POOR_MULTIPLIER = 1.25; // 125% of good threshold

  reportMetrics(snapshot: RUMSnapshot): VitalsReport {
    const vitals: VitalStatus[] = [];
    const warnings: string[] = [];
    let failingCount = 0;

    Object.entries(snapshot.vitals).forEach(([name, metric]) => {
      const threshold = CoreWebVitalsReporter.THRESHOLDS[name];
      if (!threshold) return;

      const status = this._getStatus(metric.value, threshold);
      if (status !== 'good') failingCount++;

      vitals.push({
        metric: name,
        value: metric.value,
        threshold,
        status,
        percentOfThreshold: (metric.value / threshold) * 100,
      });

      if (status === 'poor') {
        warnings.push(`${name} is critically slow (${metric.value}ms > ${threshold * CoreWebVitalsReporter.POOR_MULTIPLIER}ms)`);
      } else if (status === 'needs-improvement') {
        warnings.push(`${name} needs improvement (${metric.value}ms > ${threshold}ms)`);
      }
    });

    const overallStatus = this._getOverallStatus(failingCount, vitals.length);

    return {
      timestamp: snapshot.timestamp,
      sessionId: snapshot.sessionId,
      vitals,
      overallStatus,
      failingCount,
      warnings,
    };
  }

  private _getStatus(value: number, threshold: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= threshold) return 'good';
    if (value <= threshold * CoreWebVitalsReporter.POOR_MULTIPLIER) return 'needs-improvement';
    return 'poor';
  }

  private _getOverallStatus(failingCount: number, totalCount: number): 'good' | 'needs-improvement' | 'poor' {
    if (failingCount === 0) return 'good';
    if (failingCount <= totalCount * 0.5) return 'needs-improvement';
    return 'poor';
  }

  static getThreshold(metric: string): number {
    return CoreWebVitalsReporter.THRESHOLDS[metric] ?? 0;
  }
}

let reporterInstance: CoreWebVitalsReporter | null = null;

export const getCoreWebVitalsReporter = (): CoreWebVitalsReporter => {
  if (!reporterInstance) {
    reporterInstance = new CoreWebVitalsReporter();
  }
  return reporterInstance;
};
