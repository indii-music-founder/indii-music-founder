import { describe, expect, it } from 'vitest';
import { aggregateProviderUsage, normalizeProviderEvent } from './providerTelemetry';

describe('provider telemetry aggregation', () => {
  it('aggregates operational metadata without needing payload content', () => {
    const events = [
      {
        id: '1',
        provider: 'typesafe',
        model: 'jev-latest',
        feature: 'knowledge_evidence_rerank',
        mode: 'shadow' as const,
        status: 'success' as const,
        durationMs: 240,
        estimatedCostUsd: 0.002,
        occurredAt: '2026-09-19T20:00:00.000Z',
      },
      {
        id: '2',
        provider: 'typesafe',
        model: 'jev-latest',
        feature: 'knowledge_evidence_rerank',
        mode: 'shadow' as const,
        status: 'timeout' as const,
        durationMs: 10000,
        occurredAt: '2026-09-19T21:00:00.000Z',
      },
    ];

    const summary = aggregateProviderUsage(events);
    expect(summary.totalCalls).toBe(2);
    expect(summary.successfulCalls).toBe(1);
    expect(summary.successRate).toBe(0.5);
    expect(summary.providers[0]).toMatchObject({
      provider: 'typesafe',
      calls: 2,
      successfulCalls: 1,
      failedCalls: 1,
      modes: ['shadow'],
      features: ['knowledge_evidence_rerank'],
    });
    expect(summary.recentEvents[0]?.id).toBe('2');
  });

  it('rejects malformed or incomplete Firestore records', () => {
    expect(normalizeProviderEvent('bad', {
      provider: 'typesafe',
      model: 'jev-latest',
      feature: 'knowledge_evidence_rerank',
      mode: 'shadow',
      status: 'success',
      durationMs: -1,
      occurredAt: new Date(),
    })).toBeNull();
  });
});
