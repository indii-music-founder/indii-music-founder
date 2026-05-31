import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A2A streaming proof (service layer, real crypto + real router).
 *
 * Proves the router yields MULTIPLE progressive deltas (not one batch envelope)
 * and that the full text reconstructs. This is the regression guard against silent
 * reversion to batch — the exact gap that made streaming "batch, not token-by-token".
 */

vi.mock('./A2AConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./A2AConfig')>();
  return {
    ...actual,
    resolveA2AConfig: vi.fn().mockResolvedValue({ mode: 'loopback', baseUrl: '' }),
    invalidateA2AConfig: vi.fn(),
  };
});

vi.mock('@/services/agent/governance/DigitalHandshake', () => ({
  DigitalHandshake: { require: vi.fn().mockResolvedValue(true) },
}));

function resetClient(client: unknown) {
  const c = client as Record<string, unknown>;
  c.keyExchangeDone = false;
  c.isInitialized = false;
  c.transport = null;
  (c.breaker as { isTripped: boolean }).isTripped = false;
}

/** Reset shared singletons (encryption keys + router) so sequential tests don't
 *  interfere via leftover key state. */
async function resetSingletons() {
  const { e2eEncryptionService } = await import('@/services/security/E2EEncryptionService');
  const { a2aRouter } = await import('./A2ARouter');
  const enc = e2eEncryptionService as unknown as Record<string, { clear?: () => void }>;
  enc.keyPairs?.clear?.();
  enc.publicKeyRegistry?.clear?.();
  enc.sessionKeys?.clear?.();
  (a2aRouter as unknown as { routerInitialized: boolean }).routerInitialized = false;
}

describe('A2A streaming (real crypto loopback)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetSingletons();
  });

  // TODO: Enable once loopback transport supports stream.init → streamAgent routing
  it('yields MULTIPLE progressive deltas and reconstructs the full text', async () => {
    const { a2aClient } = await import('./A2AClient');
    resetClient(a2aClient);

    // Each chunk exceeds the 120-char flush threshold → one delta envelope each,
    // plus a mandatory final done flush. Deterministic, no timers needed.
    const chunkA = 'A'.repeat(130);
    const chunkB = 'B'.repeat(130);
    const streamAgent = vi.fn(async (_agentId: string, _task: string, onToken: (c: string) => void) => {
      onToken(chunkA);
      onToken(chunkB);
      return { text: chunkA + chunkB };
    });

    const directive = {
      id: 'd1', userId: 'u1',
      computeAllocation: { tokensUsed: 0, maxTokens: 1000, isMaximizerModeActive: false },
    } as never;

    const events: Array<{ type?: string; text?: string; done?: boolean }> = [];
    for await (const ev of a2aClient.stream(
      'marketing',
      'agent.execute',
      { task: 'draft tweets', sourceAgentId: 'generalist' },
      directive,
      { runAgent: vi.fn(), streamAgent: streamAgent as any, traceId: 't1' }
    )) {
      events.push(ev as { type?: string; text?: string; done?: boolean });
    }

    const deltas = events.filter((e) => e.type === 'delta');
    // Multiple, not one — the core assertion.
    expect(deltas.length).toBeGreaterThanOrEqual(2);
    // Exactly one terminal envelope.
    expect(events.filter((e) => e.done).length).toBe(1);
    // Full text reconstructs from the deltas.
    expect(deltas.map((d) => d.text || '').join('')).toBe(chunkA + chunkB);
    expect(streamAgent).toHaveBeenCalledWith('marketing', 'draft tweets', expect.any(Function));
  });

  it('falls back to a single batch envelope when no streamAgent is provided', async () => {
    const { a2aClient } = await import('./A2AClient');
    resetClient(a2aClient);

    const runAgent = vi.fn().mockResolvedValue({ text: 'batch result' });
    const directive = {
      id: 'd2', userId: 'u1',
      computeAllocation: { tokensUsed: 0, maxTokens: 1000, isMaximizerModeActive: false },
    } as never;

    const events: Array<{ text?: string; agentId?: string }> = [];
    for await (const ev of a2aClient.stream(
      'marketing',
      'agent.execute',
      { task: 'draft tweets', sourceAgentId: 'generalist' },
      directive,
      { runAgent, traceId: 't2' } // no streamAgent → batch
    )) {
      events.push(ev as { text?: string; agentId?: string });
    }

    expect(events.length).toBe(1);
    expect(events[0]?.text).toBe('batch result');
    // Batch generator calls runAgent(targetAgentId, task, parentContext, traceId).
    expect(runAgent).toHaveBeenCalledWith('marketing', 'draft tweets', undefined, 't2');
  });
});
