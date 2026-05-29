import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A2A loopback round-trip integration test (the doc's "Test Case 1").
 *
 * Uses the REAL e2eEncryptionService and the REAL A2ARouter over the loopback
 * transport, stubbing only runAgent. This is the test that would have caught the
 * C1 (MessageEnvelope shape) and C2 (key model) bugs: if encrypt→route→decrypt
 * is broken, the assertion fails.
 */

// Force loopback mode regardless of env.
vi.mock('./A2AConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./A2AConfig')>();
  return {
    ...actual,
    resolveA2AConfig: vi.fn().mockResolvedValue({ mode: 'loopback', baseUrl: '' }),
    invalidateA2AConfig: vi.fn(),
  };
});

// DigitalHandshake auto-approves so we exercise the crypto path, not the gate.
vi.mock('@/services/agent/governance/DigitalHandshake', () => ({
  DigitalHandshake: { require: vi.fn().mockResolvedValue(true) },
}));

describe('A2A loopback integration (real crypto + real router)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Conductor consults Marketing via consult_specialist and gets a real decrypted result', async () => {
    const { a2aClient } = await import('./A2AClient');
    // Fresh client state for a clean key exchange.
    (a2aClient as unknown as { keyExchangeDone: boolean }).keyExchangeDone = false;
    (a2aClient as unknown as { isInitialized: boolean }).isInitialized = false;
    (a2aClient as unknown as { transport: unknown }).transport = null;
    (a2aClient as unknown as { breaker: { isTripped: boolean } }).breaker.isTripped = false;

    const runAgent = vi.fn().mockResolvedValue({ text: 'Here is your launch tweet 🚀' });

    const directive = {
      id: 'd1',
      userId: 'u1',
      computeAllocation: { tokensUsed: 0, maxTokens: 1000, isMaximizerModeActive: false },
    } as never;

    const result = await a2aClient.invoke(
      'marketing',
      'agent.execute',
      { task: 'draft a launch tweet', sourceAgentId: 'generalist' },
      directive,
      { runAgent, traceId: 't1' }
    );

    // The router actually ran the target agent...
    expect(runAgent).toHaveBeenCalledWith('marketing', 'draft a launch tweet', undefined, 't1');
    // ...and the encrypted response decrypted back to the real result (proves C1+C2).
    expect(result).toEqual({ text: 'Here is your launch tweet 🚀', agentId: 'marketing' });
  });

  it('returns a JSON-RPC method-not-found error for an unknown method (still decrypts cleanly)', async () => {
    const { a2aClient } = await import('./A2AClient');
    (a2aClient as unknown as { keyExchangeDone: boolean }).keyExchangeDone = false;
    (a2aClient as unknown as { transport: unknown }).transport = null;
    (a2aClient as unknown as { breaker: { isTripped: boolean } }).breaker.isTripped = false;

    const runAgent = vi.fn();
    const directive = {
      id: 'd2',
      userId: 'u1',
      computeAllocation: { tokensUsed: 0, maxTokens: 1000, isMaximizerModeActive: false },
    } as never;

    // 'no.such.method' is not handled by the router → JSON-RPC -32601, encrypted back.
    await expect(
      a2aClient.invoke('marketing', 'no.such.method', { sourceAgentId: 'generalist' }, directive, { runAgent })
    ).rejects.toThrow(/RPC Error/);
    expect(runAgent).not.toHaveBeenCalled();
  });
});
