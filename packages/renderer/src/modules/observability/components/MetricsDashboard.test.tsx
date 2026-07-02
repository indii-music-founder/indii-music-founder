import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockGetSystemMetrics } = vi.hoisted(() => ({
    mockGetSystemMetrics: vi.fn(),
}));

vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    BarChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
}));

vi.mock('@/services/agent/observability/MetricsService', () => ({
    MetricsService: {
        getSystemMetrics: mockGetSystemMetrics,
    },
}));

import { MetricsDashboard } from './MetricsDashboard';

describe('MetricsDashboard', () => {
    it('renders the tail latency metric and completed trace summary', async () => {
        mockGetSystemMetrics.mockResolvedValue({
            totalExecutions: 3,
            completedExecutions: 2,
            totalTokens: 170,
            totalCost: 0.4,
            avgLatencyMs: 2_500,
            p95LatencyMs: 3_500,
            errorRate: 1 / 3,
            agentBreakdown: {
                generalist: {
                    count: 2,
                    cost: 0.35,
                    tokens: 150,
                },
            },
        });

        render(<MetricsDashboard />);

        expect(await screen.findByText('Tail Latency')).toBeInTheDocument();
        expect(screen.getByText('3.5s')).toBeInTheDocument();
        expect(screen.getByText('Completed traces: 2/3')).toBeInTheDocument();
    });
});
