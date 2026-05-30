import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * consult_specialist → UI bridge tests.
 * Proves the tool streams specialist deltas through context.emitToken (progressive
 * UI), and falls back to the non-streaming invoke() path when no UI sink is present.
 */

const mockStream = vi.fn();
const mockInvoke = vi.fn();

vi.mock('../a2a/A2AClient', () => ({
  a2aClient: {
    stream: (...args: unknown[]) => mockStream(...args),
    invoke: (...args: unknown[]) => mockInvoke(...args),
  },
  A2ATransportUnavailableError: class extends Error {},
}));

vi.mock('../governance/AgentIdentity', () => ({
  agentIdentityService: { recordDelegation: vi.fn() },
}));

async function* gen(events: unknown[]) {
  for (const e of events) yield e;
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    directive: { id: 'd1', userId: 'u1' },
    agentIdentity: { agentId: 'generalist' },
    runAgent: vi.fn(),
    traceId: 't1',
    ...overrides,
  };
}

describe('consult_specialist streaming bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams deltas through emitToken when a UI sink + streamAgent are present', async () => {
    const { consult_specialist } = await import('./SwarmTools');
    mockStream.mockReturnValue(gen([
      { type: 'delta', text: 'Hel', done: false },
      { type: 'delta', text: 'lo', done: false },
      { type: 'delta', text: '', done: true },
    ]));

    const emitToken = vi.fn();
    const ctx = makeContext({ emitToken, streamAgent: vi.fn() });

    const result = await consult_specialist({ targetAgentId: 'marketing', task: 'hi' }, ctx as never);

    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(emitToken.mock.calls.map((c) => c[0])).toEqual(['Hel', 'lo']);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ text: 'Hello', agentId: 'marketing' });
    expect(result.metadata?.transport).toBe('a2a-stream');
  });

  it('uses the non-streaming invoke() path when no emitToken sink is present', async () => {
    const { consult_specialist } = await import('./SwarmTools');
    mockInvoke.mockResolvedValue({ text: 'batch reply', agentId: 'marketing' });

    const ctx = makeContext(); // no emitToken / streamAgent

    const result = await consult_specialist({ targetAgentId: 'marketing', task: 'hi' }, ctx as never);

    expect(mockStream).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });
});
