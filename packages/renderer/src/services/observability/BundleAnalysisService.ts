/**
 * BundleAnalysisService — Tracks bundle size and module loading metrics
 *
 * Monitors:
 * - JavaScript bundle size
 * - CSS bundle size
 * - Performance budget thresholds
 * - Module load times
 */

export interface BundleMetrics {
  jsSize: number;
  cssSize: number;
  totalSize: number;
  entrypoints: Record<string, { size: number; gzipped?: number }>;
  timestamp: number;
}

export interface BudgetThreshold {
  jsLimit: number; // bytes
  cssLimit: number; // bytes
  totalLimit: number; // bytes
}

export class BundleAnalysisService {
  private metrics: BundleMetrics | null = null;
  private budget: BudgetThreshold = {
    jsLimit: 500 * 1024, // 500 KB
    cssLimit: 100 * 1024, // 100 KB
    totalLimit: 700 * 1024, // 700 KB
  };

  setBudgetThresholds(budget: BudgetThreshold): void {
    this.budget = budget;
  }

  recordMetrics(metrics: BundleMetrics): void {
    this.metrics = {
      ...metrics,
      timestamp: Date.now(),
    };
  }

  getMetrics(): BundleMetrics | null {
    return this.metrics;
  }

  checkBudget(): { passed: boolean; violations: string[] } {
    if (!this.metrics) {
      return { passed: false, violations: ['No bundle metrics recorded'] };
    }

    const violations: string[] = [];

    if (this.metrics.jsSize > this.budget.jsLimit) {
      violations.push(
        `JS bundle exceeds budget: ${(this.metrics.jsSize / 1024).toFixed(2)}KB > ${(this.budget.jsLimit / 1024).toFixed(2)}KB`
      );
    }

    if (this.metrics.cssSize > this.budget.cssLimit) {
      violations.push(
        `CSS bundle exceeds budget: ${(this.metrics.cssSize / 1024).toFixed(2)}KB > ${(this.budget.cssLimit / 1024).toFixed(2)}KB`
      );
    }

    if (this.metrics.totalSize > this.budget.totalLimit) {
      violations.push(
        `Total bundle exceeds budget: ${(this.metrics.totalSize / 1024).toFixed(2)}KB > ${(this.budget.totalLimit / 1024).toFixed(2)}KB`
      );
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  getEntrypoints(): Record<string, { size: number; gzipped?: number; percentOfTotal: number }> {
    if (!this.metrics) return {};

    const result: Record<string, { size: number; gzipped?: number; percentOfTotal: number }> = {};

    Object.entries(this.metrics.entrypoints).forEach(([name, entry]) => {
      result[name] = {
        ...entry,
        percentOfTotal: (entry.size / this.metrics!.totalSize) * 100,
      };
    });

    return result;
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getSummary(): string {
    if (!this.metrics) return 'No metrics recorded';

    return `JS: ${this.formatSize(this.metrics.jsSize)}, CSS: ${this.formatSize(this.metrics.cssSize)}, Total: ${this.formatSize(this.metrics.totalSize)}`;
  }
}

let bundleInstance: BundleAnalysisService | null = null;

export const getBundleAnalysisService = (): BundleAnalysisService => {
  if (!bundleInstance) {
    bundleInstance = new BundleAnalysisService();
  }
  return bundleInstance;
};
