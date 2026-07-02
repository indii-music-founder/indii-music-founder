import { db } from '@/services/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { AgentTrace } from './types';

export interface SystemMetrics {
    totalExecutions: number;
    completedExecutions: number;
    totalTokens: number;
    totalCost: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    errorRate: number;
    agentBreakdown: Record<string, {
        count: number;
        cost: number;
        tokens: number;
    }>;
}

function calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) {
        return 0;
    }

    if (values.length === 1) {
        return values[0];
    }

    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.ceil((percentile / 100) * sorted.length);
    const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);

    return sorted[index];
}

export class MetricsService {
    private static readonly COLLECTION = 'agent_traces';

    /**
     * Get aggregated metrics for a specific time range
     */
    static async getSystemMetrics(days: number = 7): Promise<SystemMetrics> {
        const startTime = new Date();
        startTime.setDate(startTime.getDate() - days);

        const q = query(
            collection(db, this.COLLECTION),
            where('startTime', '>=', Timestamp.fromDate(startTime)),
            orderBy('startTime', 'desc')
        );

        const snapshot = await getDocs(q);
        const traces = snapshot.docs.map(doc => doc.data() as AgentTrace);

        const metrics: SystemMetrics = {
            totalExecutions: traces.length,
            completedExecutions: 0,
            totalTokens: 0,
            totalCost: 0,
            avgLatencyMs: 0,
            p95LatencyMs: 0,
            errorRate: 0,
            agentBreakdown: {}
        };

        let totalLatency = 0;
        let completedTraceCount = 0;
        let errorCount = 0;
        const latencySamples: number[] = [];

        traces.forEach(trace => {
            // Aggregate tokens and cost
            if (trace.totalUsage) {
                metrics.totalTokens += trace.totalUsage.totalTokens || 0;
                metrics.totalCost += trace.totalUsage.estimatedCost || 0;
            }

            // Aggregate latency — narrow FieldValue union to Timestamp before calling toMillis()
            if (trace.startTime instanceof Timestamp && trace.endTime instanceof Timestamp) {
                const start = trace.startTime.toMillis();
                const end = trace.endTime.toMillis();
                const duration = end - start;
                totalLatency += duration;
                latencySamples.push(duration);
                completedTraceCount++;
            }

            // Aggregate errors
            if (trace.status === 'failed') {
                errorCount++;
            }

            // Agent breakdown
            const agentId = trace.agentId;
            if (!metrics.agentBreakdown[agentId]) {
                metrics.agentBreakdown[agentId] = { count: 0, cost: 0, tokens: 0 };
            }
            metrics.agentBreakdown[agentId].count++;
            metrics.agentBreakdown[agentId].cost += trace.totalUsage?.estimatedCost || 0;
            metrics.agentBreakdown[agentId].tokens += trace.totalUsage?.totalTokens || 0;
        });

        metrics.completedExecutions = completedTraceCount;
        metrics.avgLatencyMs = completedTraceCount > 0 ? totalLatency / completedTraceCount : 0;
        metrics.p95LatencyMs = calculatePercentile(latencySamples, 95);
        metrics.errorRate = traces.length > 0 ? errorCount / traces.length : 0;

        return metrics;
    }

    /**
     * Get recent high-cost traces
     */
    static async getHighCostTraces(count: number = 5): Promise<AgentTrace[]> {
        const q = query(
            collection(db, this.COLLECTION),
            orderBy('totalUsage.estimatedCost', 'desc'),
            limit(count)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as AgentTrace);
    }
}
