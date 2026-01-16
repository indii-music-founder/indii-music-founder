import { db } from '@/services/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { AgentTrace, UsageMetrics } from './types';

export interface SystemMetrics {
    totalExecutions: number;
    totalTokens: number;
    totalCost: number;
    avgLatencyMs: number;
    errorRate: number;
    agentBreakdown: Record<string, {
        count: number;
        cost: number;
        tokens: number;
    }>;
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
            totalTokens: 0,
            totalCost: 0,
            avgLatencyMs: 0,
            errorRate: 0,
            agentBreakdown: {}
        };

        let totalLatency = 0;
        let errorCount = 0;

        traces.forEach(trace => {
            // Aggregate tokens and cost
            if (trace.totalUsage) {
                metrics.totalTokens += trace.totalUsage.totalTokens || 0;
                metrics.totalCost += trace.totalUsage.estimatedCost || 0;
            }

            // Aggregate latency
            if (trace.startTime && trace.endTime) {
                const start = trace.startTime.toMillis();
                const end = trace.endTime.toMillis();
                totalLatency += (end - start);
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

        metrics.avgLatencyMs = traces.length > 0 ? totalLatency / traces.length : 0;
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
