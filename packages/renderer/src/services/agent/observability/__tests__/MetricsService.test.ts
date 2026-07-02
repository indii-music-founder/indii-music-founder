import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDocs = vi.hoisted(() => vi.fn());
const mockQuery = vi.hoisted(() => vi.fn());
const mockCollection = vi.hoisted(() => vi.fn());
const mockWhere = vi.hoisted(() => vi.fn());
const mockOrderBy = vi.hoisted(() => vi.fn());
const mockLimit = vi.hoisted(() => vi.fn());
const mockTimestamp = vi.hoisted(() => {
  class MockTimestamp {
    private readonly millis: number;

    constructor(millis: number) {
      this.millis = millis;
    }

    toMillis(): number {
      return this.millis;
    }

    static fromDate(date: Date): MockTimestamp {
      return new MockTimestamp(date.getTime());
    }
  }

  return { MockTimestamp };
});

vi.mock('@/services/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  getDocs: mockGetDocs,
  Timestamp: mockTimestamp.MockTimestamp,
}));

import { MetricsService } from '../MetricsService';

describe('MetricsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('averages latency only across completed traces with valid timestamps', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            agentId: 'generalist',
            status: 'completed',
            startTime: new mockTimestamp.MockTimestamp(1_000),
            endTime: new mockTimestamp.MockTimestamp(2_500),
            totalUsage: {
              totalTokens: 100,
              estimatedCost: 0.25,
            },
          }),
        },
        {
          data: () => ({
            agentId: 'generalist',
            status: 'failed',
            startTime: new mockTimestamp.MockTimestamp(3_000),
            totalUsage: {
              totalTokens: 50,
              estimatedCost: 0.10,
            },
          }),
        },
        {
          data: () => ({
            agentId: 'legal',
            status: 'completed',
            startTime: new mockTimestamp.MockTimestamp(4_000),
            endTime: new mockTimestamp.MockTimestamp(7_500),
            totalUsage: {
              totalTokens: 20,
              estimatedCost: 0.05,
            },
          }),
        },
      ],
    });

    const metrics = await MetricsService.getSystemMetrics(7);

    expect(metrics.totalExecutions).toBe(3);
    expect(metrics.completedExecutions).toBe(2);
    expect(metrics.totalTokens).toBe(170);
    expect(metrics.totalCost).toBeCloseTo(0.4);
    expect(metrics.avgLatencyMs).toBe(2_500);
    expect(metrics.p95LatencyMs).toBe(3_500);
    expect(metrics.errorRate).toBeCloseTo(1 / 3);
    expect(metrics.agentBreakdown.generalist).toEqual({
      count: 2,
      cost: 0.35,
      tokens: 150,
    });
    expect(metrics.agentBreakdown.legal).toEqual({
      count: 1,
      cost: 0.05,
      tokens: 20,
    });
  });
});
