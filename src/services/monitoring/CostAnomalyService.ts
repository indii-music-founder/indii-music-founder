/**
 * Item 302: Cost Anomaly Detection Service
 *
 * Monitors Firebase/GCP usage costs and alerts on anomalies.
 * Complements the GCP alerting policies defined in docs/COST_ANOMALY_ALERTS.md.
 *
 * Client-side tracking:
 *   - Firestore read/write counts
 *   - Storage bandwidth estimates
 *   - Cloud Function invocation tracking
 *   - AI API token usage estimation
 */

export interface CostMetric {
    service: string;
    metric: string;
    currentValue: number;
    previousValue: number;
    unit: string;
    timestamp: string;
}

export interface CostAlert {
    id: string;
    severity: 'info' | 'warning' | 'critical';
    service: string;
    message: string;
    currentCost: number;
    threshold: number;
    timestamp: string;
}

export interface UsageSummary {
    period: string;
    firestoreReads: number;
    firestoreWrites: number;
    storageBytes: number;
    functionInvocations: number;
    aiTokensUsed: number;
    estimatedCostUSD: number;
    alerts: CostAlert[];
}

// Cost estimation constants (Firebase Blaze plan pricing, approximate)
const PRICING = {
    firestoreRead: 0.06 / 100_000,     // $0.06 per 100K reads
    firestoreWrite: 0.18 / 100_000,    // $0.18 per 100K writes
    storageGB: 0.026,                   // $0.026 per GB/month
    functionInvocation: 0.40 / 1_000_000, // $0.40 per million
    geminiInputToken: 0.00125 / 1_000,  // Flash pricing
    geminiOutputToken: 0.005 / 1_000,
};

// Default thresholds for alerts
const DEFAULT_THRESHOLDS = {
    dailyCostUSD: 10,           // Alert if daily cost > $10
    firestoreReadsPerHour: 50_000, // Alert on high read volume
    aiTokensPerDay: 1_000_000,  // 1M tokens/day
    storageGrowthGB: 5,         // Alert on 5GB growth in a day
};

export class CostAnomalyService {
    private metrics: CostMetric[] = [];
    private alerts: CostAlert[] = [];
    private counters = {
        firestoreReads: 0,
        firestoreWrites: 0,
        storageBytes: 0,
        functionInvocations: 0,
        aiTokensUsed: 0,
    };
    private lastResetTime: number = Date.now();

    /**
     * Track a Firestore read operation.
     */
    trackRead(count: number = 1): void {
        this.counters.firestoreReads += count;
        this.checkThresholds();
    }

    /**
     * Track a Firestore write operation.
     */
    trackWrite(count: number = 1): void {
        this.counters.firestoreWrites += count;
        this.checkThresholds();
    }

    /**
     * Track storage usage.
     */
    trackStorage(bytes: number): void {
        this.counters.storageBytes += bytes;
    }

    /**
     * Track a Cloud Function invocation.
     */
    trackFunctionCall(count: number = 1): void {
        this.counters.functionInvocations += count;
    }

    /**
     * Track AI token usage.
     */
    trackAITokens(inputTokens: number, outputTokens: number): void {
        this.counters.aiTokensUsed += inputTokens + outputTokens;
        this.checkThresholds();
    }

    /**
     * Get estimated cost for the current tracking period.
     */
    getEstimatedCost(): number {
        const cost =
            this.counters.firestoreReads * PRICING.firestoreRead +
            this.counters.firestoreWrites * PRICING.firestoreWrite +
            (this.counters.storageBytes / (1024 ** 3)) * PRICING.storageGB +
            this.counters.functionInvocations * PRICING.functionInvocation +
            this.counters.aiTokensUsed * PRICING.geminiInputToken;

        return Math.round(cost * 100) / 100;
    }

    /**
     * Check if any thresholds are breached.
     */
    private checkThresholds(): void {
        const hoursSinceReset = (Date.now() - this.lastResetTime) / (1000 * 60 * 60);
        const readsPerHour = this.counters.firestoreReads / Math.max(hoursSinceReset, 0.01);

        if (readsPerHour > DEFAULT_THRESHOLDS.firestoreReadsPerHour) {
            this.addAlert('warning', 'Firestore',
                `High read volume: ${Math.round(readsPerHour)}/hr (threshold: ${DEFAULT_THRESHOLDS.firestoreReadsPerHour}/hr)`,
                readsPerHour * PRICING.firestoreRead,
                DEFAULT_THRESHOLDS.firestoreReadsPerHour * PRICING.firestoreRead
            );
        }

        if (this.counters.aiTokensUsed > DEFAULT_THRESHOLDS.aiTokensPerDay) {
            this.addAlert('warning', 'Gemini AI',
                `High token usage: ${this.counters.aiTokensUsed.toLocaleString()} tokens (threshold: ${DEFAULT_THRESHOLDS.aiTokensPerDay.toLocaleString()})`,
                this.counters.aiTokensUsed * PRICING.geminiInputToken,
                DEFAULT_THRESHOLDS.aiTokensPerDay * PRICING.geminiInputToken
            );
        }

        const estimatedCost = this.getEstimatedCost();
        if (estimatedCost > DEFAULT_THRESHOLDS.dailyCostUSD) {
            this.addAlert('critical', 'Overall',
                `Estimated daily cost: $${estimatedCost} (threshold: $${DEFAULT_THRESHOLDS.dailyCostUSD})`,
                estimatedCost,
                DEFAULT_THRESHOLDS.dailyCostUSD
            );
        }
    }

    /**
     * Add an alert (deduplicates within 1 hour).
     */
    private addAlert(severity: CostAlert['severity'], service: string, message: string, currentCost: number, threshold: number): void {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const isDuplicate = this.alerts.some(a =>
            a.service === service && a.severity === severity && a.timestamp > oneHourAgo
        );

        if (!isDuplicate) {
            this.alerts.push({
                id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                severity,
                service,
                message,
                currentCost,
                threshold,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Get all active alerts.
     */
    getAlerts(): CostAlert[] {
        return [...this.alerts];
    }

    /**
     * Get a usage summary.
     */
    getSummary(): UsageSummary {
        return {
            period: `${new Date(this.lastResetTime).toISOString()} to ${new Date().toISOString()}`,
            firestoreReads: this.counters.firestoreReads,
            firestoreWrites: this.counters.firestoreWrites,
            storageBytes: this.counters.storageBytes,
            functionInvocations: this.counters.functionInvocations,
            aiTokensUsed: this.counters.aiTokensUsed,
            estimatedCostUSD: this.getEstimatedCost(),
            alerts: this.getAlerts(),
        };
    }

    /**
     * Reset counters (call daily or on schedule).
     */
    reset(): void {
        this.counters = {
            firestoreReads: 0,
            firestoreWrites: 0,
            storageBytes: 0,
            functionInvocations: 0,
            aiTokensUsed: 0,
        };
        this.alerts = [];
        this.lastResetTime = Date.now();
    }
}

export const costAnomalyService = new CostAnomalyService();
