import { describe, it, expect, vi, beforeEach } from 'vitest';
import { a2aClient } from './A2AClient';
import { e2eEncryptionService } from '@/services/security/E2EEncryptionService';
import { DigitalHandshake } from '@/services/agent/governance/DigitalHandshake';

vi.unmock('@/services/agent/a2a/A2AClient');

// Force HTTP transport so we can assert the wire contract (URLs + fetch).
// The loopback round-trip is covered by A2A.integration.test.ts with REAL crypto.
vi.mock('./A2AConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./A2AConfig')>();
  return {
    ...actual,
    resolveA2AConfig: vi.fn().mockResolvedValue({ mode: 'http', baseUrl: 'http://localhost:50080/a2a' }),
    invalidateA2AConfig: vi.fn(),
  };
});

vi.mock('@/services/security/E2EEncryptionService', () => ({
  e2eEncryptionService: {
    initialize: vi.fn(),
    exportPublicKey: vi.fn().mockResolvedValue({ kty: 'RSA' }),
    registerPeerPublicKey: vi.fn(),
    encryptMessage: vi.fn().mockResolvedValue({ id: 'msg1', encrypted: {}, signature: 'sig' }),
    decryptMessage: vi.fn(),
  },
}));

vi.mock('@/services/agent/governance/DigitalHandshake', () => ({
  DigitalHandshake: { require: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

/** Reset all internal A2AClient state between tests. */
function resetClient() {
  const c = a2aClient as unknown as Record<string, unknown>;
  c.breaker = { isTripped: false, tripTime: 0, cooldown: 30000 };
  c.isInitialized = false;
  c.keyExchangeDone = false;
  c.cachedCards = [];
  c.transport = null;
}

const validCard = {
  schemaVersion: '1.0.0',
  agentId: 'marketing',
  displayName: 'Marketing',
  description: 'Marketing agent',
  capabilities: [],
  inputSchemas: {},
  outputSchemas: {},
  costModel: { perTokenInUsd: 0.01, perTokenOutUsd: 0.2 },
  riskTier: 'read',
  sla: { modeSync: { p50Ms: 100, p99Ms: 200 }, modeStream: { firstByteMs: 50 } },
  publicKeyJwk: { kty: 'RSA' },
};

describe('A2AClient (HTTP transport contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    resetClient();
  });

  describe('discover', () => {
    it('hits the discovery endpoint and parses AgentCards', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ agents: [validCard] }) });

      const cards = await a2aClient.discover();

      expect(cards.length).toBeGreaterThan(0);
      expect(cards[0]?.agentId).toBe('marketing');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:50080/a2a/discovery', expect.any(Object));
    });

    it('throws if discovery fetch fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, statusText: 'Internal Server Error' });
      await expect(a2aClient.discover()).rejects.toThrow('A2A discovery failed: Internal Server Error');
    });
  });

  describe('invoke', () => {
    it('runs the handshake, encrypts, and POSTs to /rpc', async () => {
      const mockDirective = { id: 'd1', userId: 'u1', computeAllocation: { tokensUsed: 0, maxTokens: 1000 } } as never;
      vi.mocked(DigitalHandshake.require).mockResolvedValue(true);
      vi.mocked(e2eEncryptionService.decryptMessage).mockResolvedValue({ result: 'success' });
      // Every fetch (discovery, key.exchange, /rpc) succeeds.
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ agents: [validCard] }) });

      const result = await a2aClient.invoke('marketing', 'agent.execute', { foo: 'bar' }, mockDirective);

      expect(DigitalHandshake.require).toHaveBeenCalledWith(
        mockDirective,
        'Consult specialist marketing via A2A sync',
        false,
        'a2a:consult'
      );
      expect(e2eEncryptionService.encryptMessage).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:50080/a2a/rpc', expect.any(Object));
      expect(result).toBe('success');
    });

    it('throws if the handshake is not approved (no fallback)', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ agents: [validCard] }) });
      vi.mocked(DigitalHandshake.require).mockResolvedValue(false);
      await expect(
        a2aClient.invoke('marketing', 'agent.execute', {}, { id: 'd1' } as never)
      ).rejects.toThrow('A2A invocation paused for Digital Handshake approval');
    });
  });
});
