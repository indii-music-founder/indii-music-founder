/**
 * CoreWebVitalsReporter.test.ts
 * Unit tests for Core Web Vitals reporting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CoreWebVitalsReporter } from './CoreWebVitalsReporter';
import type { RUMSnapshot } from './RealUserMonitoringService';

describe('CoreWebVitalsReporter', () => {
  let reporter: CoreWebVitalsReporter;

  beforeEach(() => {
    reporter = new CoreWebVitalsReporter();
  });

  describe('Metric Reporting', () => {
    it('should report metrics with correct thresholds', () => {
      const snapshot: RUMSnapshot = {
        timestamp: Date.now(),
        url: 'http://localhost/',
        userAgent: 'test',
        sessionId: 'test-session',
        pageLoadTime: 0,
        vitals: {
          LCP: {
            name: 'LCP',
            value: 2000,
            delta: 0,
            rating: 'good',
            id: 'lcp-1',
            navigationType: 'navigate',
          },
        },
      };

      const report = reporter.reportMetrics(snapshot);
      expect(report.vitals).toHaveLength(1);
      expect(report.vitals[0]?.metric).toBe('LCP');
      expect(report.vitals[0]?.status).toBe('good');
    });

    it('should identify metrics exceeding thresholds', () => {
      const snapshot: RUMSnapshot = {
        timestamp: Date.now(),
        url: 'http://localhost/',
        userAgent: 'test',
        sessionId: 'test-session',
        pageLoadTime: 0,
        vitals: {
          LCP: {
            name: 'LCP',
            value: 5000, // Exceeds 2500ms threshold
            delta: 0,
            rating: 'poor',
            id: 'lcp-1',
            navigationType: 'navigate',
          },
        },
      };

      const report = reporter.reportMetrics(snapshot);
      expect(report.vitals[0]?.status).toBe('poor');
      expect(report.failingCount).toBe(1);
      expect(report.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Overall Status', () => {
    it('should report good status for passing vitals', () => {
      const snapshot: RUMSnapshot = {
        timestamp: Date.now(),
        url: 'http://localhost/',
        userAgent: 'test',
        sessionId: 'test-session',
        pageLoadTime: 0,
        vitals: {
          LCP: {
            name: 'LCP',
            value: 2000,
            delta: 0,
            rating: 'good',
            id: 'lcp-1',
            navigationType: 'navigate',
          },
          INP: {
            name: 'INP',
            value: 80,
            delta: 0,
            rating: 'good',
            id: 'inp-1',
            navigationType: 'navigate',
          },
        },
      };

      const report = reporter.reportMetrics(snapshot);
      expect(report.overallStatus).toBe('good');
      expect(report.failingCount).toBe(0);
    });

    it('should identify poor overall status', () => {
      const snapshot: RUMSnapshot = {
        timestamp: Date.now(),
        url: 'http://localhost/',
        userAgent: 'test',
        sessionId: 'test-session',
        pageLoadTime: 0,
        vitals: {
          LCP: {
            name: 'LCP',
            value: 5000,
            delta: 0,
            rating: 'poor',
            id: 'lcp-1',
            navigationType: 'navigate',
          },
          INP: {
            name: 'INP',
            value: 500,
            delta: 0,
            rating: 'poor',
            id: 'inp-1',
            navigationType: 'navigate',
          },
        },
      };

      const report = reporter.reportMetrics(snapshot);
      expect(report.overallStatus).toBe('poor');
      expect(report.failingCount).toBeGreaterThan(0);
    });
  });

  describe('Thresholds', () => {
    it('should return correct thresholds', () => {
      expect(CoreWebVitalsReporter.getThreshold('LCP')).toBe(2500);
      expect(CoreWebVitalsReporter.getThreshold('INP')).toBe(200);
      expect(CoreWebVitalsReporter.getThreshold('CLS')).toBe(0.1);
      expect(CoreWebVitalsReporter.getThreshold('FCP')).toBe(1800);
      expect(CoreWebVitalsReporter.getThreshold('TTFB')).toBe(600);
    });

    it('should return 0 for unknown metric', () => {
      expect(CoreWebVitalsReporter.getThreshold('UNKNOWN')).toBe(0);
    });
  });

  describe('Warnings', () => {
    it('should generate warnings for failing metrics', () => {
      const snapshot: RUMSnapshot = {
        timestamp: Date.now(),
        url: 'http://localhost/',
        userAgent: 'test',
        sessionId: 'test-session',
        pageLoadTime: 0,
        vitals: {
          LCP: {
            name: 'LCP',
            value: 3000,
            delta: 0,
            rating: 'needs-improvement',
            id: 'lcp-1',
            navigationType: 'navigate',
          },
        },
      };

      const report = reporter.reportMetrics(snapshot);
      expect(report.warnings.length).toBeGreaterThan(0);
      expect(report.warnings[0]).toMatch(/LCP/);

    });
  });
});
