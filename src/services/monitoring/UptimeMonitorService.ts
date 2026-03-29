/**
 * Item 301: SLA Uptime Monitoring Service
 *
 * Tracks application uptime and response times against SLA targets.
 * Reports degradation alerts when thresholds are breached.
 *
 * For GCP Cloud Monitoring integration, see docs/COST_ANOMALY_ALERTS.md
 * for the gcloud commands to set up real alerting policies.
 *
 * SLA Targets (default):
 *   - Uptime: 99.9% (43.8 min downtime/month)
 *   - P95 Response Time: < 2000ms
 *   - Error Rate: < 0.1%
 */

import { logger } from '@/utils/logger';

export interface SLATarget {
    uptimePercent: number;      // e.g., 99.9
    p95ResponseMs: number;      // e.g., 2000
    maxErrorRatePercent: number; // e.g., 0.1
}

export interface HealthCheck {
    endpoint: string;
    status: 'healthy' | 'degraded' | 'down';
    responseTimeMs: number;
    statusCode: number;
    checkedAt: string;
    error?: string;
}

export interface UptimeReport {
    period: string;            // e.g., "2025-03-01 to 2025-03-31"
    totalChecks: number;
    successfulChecks: number;
    uptimePercent: number;
    avgResponseMs: number;
    p95ResponseMs: number;
    p99ResponseMs: number;
    incidentCount: number;
    slaCompliant: boolean;
    violations: string[];
}

const DEFAULT_SLA: SLATarget = {
    uptimePercent: 99.9,
    p95ResponseMs: 2000,
    maxErrorRatePercent: 0.1,
};

const HEALTH_ENDPOINTS = [
    { name: 'Studio App', url: '/api/health' },
    { name: 'Firebase Auth', url: 'https://identitytoolkit.googleapis.com/v1/accounts:lookup' },
    { name: 'Firestore', url: '/_/firestore/health' },
];

export class UptimeMonitorService {
    private sla: SLATarget;
    private checkHistory: HealthCheck[] = [];
    private intervalId: ReturnType<typeof setInterval> | null = null;

    constructor(sla: Partial<SLATarget> = {}) {
        this.sla = { ...DEFAULT_SLA, ...sla };
    }

    /**
     * Perform a single health check on an endpoint.
     */
    async checkEndpoint(url: string): Promise<HealthCheck> {
        const startTime = performance.now();
        let statusCode = 0;
        let error: string | undefined;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10_000);

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' },
            });

            clearTimeout(timeout);
            statusCode = response.status;
        } catch (err: unknown) {
            error = err instanceof Error ? err.message : String(err);
            statusCode = 0;
        }

        const responseTimeMs = Math.round(performance.now() - startTime);
        const status = error || statusCode >= 500 ? 'down'
            : statusCode >= 400 || responseTimeMs > this.sla.p95ResponseMs ? 'degraded'
                : 'healthy';

        const check: HealthCheck = {
            endpoint: url,
            status,
            responseTimeMs,
            statusCode,
            checkedAt: new Date().toISOString(),
            error,
        };

        this.checkHistory.push(check);

        // Keep last 10,000 checks in memory
        if (this.checkHistory.length > 10_000) {
            this.checkHistory = this.checkHistory.slice(-10_000);
        }

        return check;
    }

    /**
     * Run health checks on all configured endpoints.
     */
    async checkAll(): Promise<HealthCheck[]> {
        const results = await Promise.all(
            HEALTH_ENDPOINTS.map(ep => this.checkEndpoint(ep.url))
        );
        return results;
    }

    /**
     * Start periodic monitoring.
     */
    startMonitoring(intervalMs: number = 60_000): void {
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            this.checkAll().catch(err => {
                logger.error('[UptimeMonitor] Check failed:', err);
            });
        }, intervalMs);

        // Run immediately
        this.checkAll();
    }

    /**
     * Stop monitoring.
     */
    stopMonitoring(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Generate an uptime report for a given time range.
     */
    generateReport(fromDate?: Date, toDate?: Date): UptimeReport {
        const from = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
        const to = toDate || new Date();

        const checks = this.checkHistory.filter(c => {
            const d = new Date(c.checkedAt);
            return d >= from && d <= to;
        });

        const totalChecks = checks.length || 1;
        const successfulChecks = checks.filter(c => c.status === 'healthy').length;
        const uptimePercent = (successfulChecks / totalChecks) * 100;

        const responseTimes = checks.map(c => c.responseTimeMs).sort((a, b) => a - b);
        const avgResponseMs = responseTimes.reduce((a, b) => a + b, 0) / totalChecks;
        const p95Index = Math.floor(responseTimes.length * 0.95);
        const p99Index = Math.floor(responseTimes.length * 0.99);
        const p95ResponseMs = responseTimes[p95Index] || 0;
        const p99ResponseMs = responseTimes[p99Index] || 0;

        const errorChecks = checks.filter(c => c.status === 'down');
        const errorRate = (errorChecks.length / totalChecks) * 100;

        const violations: string[] = [];
        if (uptimePercent < this.sla.uptimePercent) {
            violations.push(`Uptime ${uptimePercent.toFixed(2)}% < target ${this.sla.uptimePercent}%`);
        }
        if (p95ResponseMs > this.sla.p95ResponseMs) {
            violations.push(`P95 ${p95ResponseMs}ms > target ${this.sla.p95ResponseMs}ms`);
        }
        if (errorRate > this.sla.maxErrorRatePercent) {
            violations.push(`Error rate ${errorRate.toFixed(2)}% > target ${this.sla.maxErrorRatePercent}%`);
        }

        // Count incidents (consecutive down checks)
        let incidentCount = 0;
        let inIncident = false;
        for (const check of checks) {
            if (check.status === 'down' && !inIncident) {
                incidentCount++;
                inIncident = true;
            } else if (check.status !== 'down') {
                inIncident = false;
            }
        }

        return {
            period: `${from.toISOString().split('T')[0]} to ${to.toISOString().split('T')[0]}`,
            totalChecks,
            successfulChecks,
            uptimePercent: Math.round(uptimePercent * 100) / 100,
            avgResponseMs: Math.round(avgResponseMs),
            p95ResponseMs,
            p99ResponseMs,
            incidentCount,
            slaCompliant: violations.length === 0,
            violations,
        };
    }

    /**
     * Get the latest health status.
     */
    getLatestStatus(): HealthCheck | null {
        return this.checkHistory[this.checkHistory.length - 1] || null;
    }
}

export const uptimeMonitorService = new UptimeMonitorService();
