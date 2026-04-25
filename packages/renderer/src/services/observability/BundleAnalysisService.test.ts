/**
 * BundleAnalysisService.test.ts
 * Unit tests for bundle size analysis
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BundleAnalysisService } from './BundleAnalysisService';
import type { BundleMetrics } from './BundleAnalysisService';

describe('BundleAnalysisService', () => {
  let service: BundleAnalysisService;

  beforeEach(() => {
    service = new BundleAnalysisService();
  });

  describe('Budget Configuration', () => {
    it('should set budget thresholds', () => {
      const budget = {
        jsLimit: 600 * 1024,
        cssLimit: 150 * 1024,
        totalLimit: 800 * 1024,
      };

      service.setBudgetThresholds(budget);

      // Verify by checking that budget affects budget checking
      const metrics: BundleMetrics = {
        jsSize: 700 * 1024, // exceeds 600KB
        cssSize: 100 * 1024,
        totalSize: 800 * 1024,
        entrypoints: {},
        timestamp: Date.now(),
      };

      service.recordMetrics(metrics);
      const { passed, violations } = service.checkBudget();

      expect(passed).toBe(false);
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('Metrics Recording', () => {
    it('should record bundle metrics', () => {
      const metrics: BundleMetrics = {
        jsSize: 400 * 1024,
        cssSize: 80 * 1024,
        totalSize: 480 * 1024,
        entrypoints: {
          main: { size: 250 * 1024 },
          vendor: { size: 150 * 1024 },
        },
        timestamp: Date.now(),
      };

      service.recordMetrics(metrics);
      const recorded = service.getMetrics();

      expect(recorded).toBeDefined();
      expect(recorded?.jsSize).toBe(metrics.jsSize);
      expect(recorded?.cssSize).toBe(metrics.cssSize);
    });

    it('should update timestamp on record', () => {
      const metrics: BundleMetrics = {
        jsSize: 400 * 1024,
        cssSize: 80 * 1024,
        totalSize: 480 * 1024,
        entrypoints: {},
        timestamp: 0, // old timestamp
      };

      service.recordMetrics(metrics);
      const recorded = service.getMetrics();

      expect(recorded?.timestamp).not.toBe(0);
      expect(recorded?.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Budget Checking', () => {
    it('should pass budget check for small bundles', () => {
      const metrics: BundleMetrics = {
        jsSize: 200 * 1024,
        cssSize: 50 * 1024,
        totalSize: 250 * 1024,
        entrypoints: {},
        timestamp: Date.now(),
      };

      service.recordMetrics(metrics);
      const { passed, violations } = service.checkBudget();

      expect(passed).toBe(true);
      expect(violations.length).toBe(0);
    });

    it('should fail budget check for JS exceeding limit', () => {
      const metrics: BundleMetrics = {
        jsSize: 600 * 1024,
        cssSize: 50 * 1024,
        totalSize: 650 * 1024,
        entrypoints: {},
        timestamp: Date.now(),
      };

      service.recordMetrics(metrics);
      const { passed, violations } = service.checkBudget();

      expect(passed).toBe(false);
      expect(violations.some(v => v.includes('JS'))).toBe(true);
    });

    it('should report all violations', () => {
      const metrics: BundleMetrics = {
        jsSize: 600 * 1024, // exceeds 500KB
        cssSize: 150 * 1024, // exceeds 100KB
        totalSize: 750 * 1024, // exceeds 700KB
        entrypoints: {},
        timestamp: Date.now(),
      };

      service.recordMetrics(metrics);
      const { passed, violations } = service.checkBudget();

      expect(passed).toBe(false);
      expect(violations.length).toBe(3);
    });

    it('should return error when no metrics recorded', () => {
      const { passed, violations } = service.checkBudget();
      expect(passed).toBe(false);
      expect(violations).toContain('No bundle metrics recorded');
    });
  });

  describe('Entrypoints Analysis', () => {
    it('should analyze entrypoint sizes', () => {
      const metrics: BundleMetrics = {
        jsSize: 400 * 1024,
        cssSize: 80 * 1024,
        totalSize: 480 * 1024,
        entrypoints: {
          main: { size: 250 * 1024, gzipped: 80 * 1024 },
          vendor: { size: 150 * 1024, gzipped: 50 * 1024 },
        },
        timestamp: Date.now(),
      };

      service.recordMetrics(metrics);
      const entrypoints = service.getEntrypoints();

      expect(entrypoints.main).toBeDefined();
      expect(entrypoints.vendor).toBeDefined();
      expect(entrypoints.main?.percentOfTotal).toBeGreaterThan(0);
      expect(entrypoints.main?.percentOfTotal).toBeLessThanOrEqual(100);
    });

    it('should return empty object when no metrics', () => {
      const entrypoints = service.getEntrypoints();
      expect(entrypoints).toEqual({});
    });
  });

  describe('Size Formatting', () => {
    it('should format bytes correctly', () => {
      expect(service.formatSize(0)).toBe('0 B');
      expect(service.formatSize(1024)).toContain('KB');
      expect(service.formatSize(1024 * 1024)).toContain('MB');
    });

    it('should provide summary', () => {
      const metrics: BundleMetrics = {
        jsSize: 400 * 1024,
        cssSize: 80 * 1024,
        totalSize: 480 * 1024,
        entrypoints: {},
        timestamp: Date.now(),
      };

      service.recordMetrics(metrics);
      const summary = service.getSummary();

      expect(summary).toContain('KB');
      expect(summary).toContain('JS');
      expect(summary).toContain('CSS');
    });

    it('should return default message when no metrics', () => {
      const summary = service.getSummary();
      expect(summary).toContain('No metrics');
    });
  });
});
