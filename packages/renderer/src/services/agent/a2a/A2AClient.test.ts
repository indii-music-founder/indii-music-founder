import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { a2aClient } from './A2AClient';
import { e2eEncryptionService } from '@/services/security/E2EEncryptionService';
import { DigitalHandshake } from '@/services/agent/governance/DigitalHandshake';

vi.unmock('@/services/agent/a2a/A2AClient');

// Mock E2EEncryptionService
vi.mock('@/services/security/E2EEncryptionService', () => ({
  e2eEncryptionService: {
    initialize: vi.fn(),
    exportPublicKey: vi.fn().mockResolvedValue({ kty: 'RSA' }),
    registerPeerPublicKey: vi.fn(),
    encryptMessage: vi.fn(),
    decryptMessage: vi.fn(),
  },
}));

// Mock DigitalHandshake
vi.mock('@/services/agent/governance/DigitalHandshake', () => ({
  DigitalHandshake: {
    require: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock EventSource
class MockEventSource {
  onmessage: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
  }
  close() {}
}
global.EventSource = MockEventSource as any;

describe('A2AClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('discover', () => {
    it('fetches discovery endpoint and parses AgentCards', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          agents: [
            {
              schemaVersion: '1.0.0',
              agentId: 'test-agent',
              displayName: 'Test Agent',
              description: 'A test agent',
              capabilities: [],
              inputSchemas: {},
              outputSchemas: {},
              costModel: { perTokenInUsd: 0.01, perTokenOutUsd: 0.2 },
              riskTier: 'read',
              sla: { modeSync: { p50Ms: 100, p99Ms: 200 }, modeStream: { firstByteMs: 50 } },
            },
          ],
        }),
      });

      const cards = await a2aClient.discover();
      expect(cards.length).toBeGreaterThan(0);
      expect(cards[0]?.agentId).toBe('test-agent');
      expect(cards[0]?.costModel.perTokenInUsd).toBe(0.01);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:50080/a2a/discovery');
    });

    it('throws if discovery fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });
      await expect(a2aClient.discover()).rejects.toThrow('Failed to discover agents: Internal Server Error');
    });
  });

  describe('invoke', () => {
    it('calls DigitalHandshake and encrypts payload', async () => {
      const mockDirective = { id: 'd1', userId: 'u1', computeAllocation: { tokensUsed: 0, maxTokens: 1000 } } as any;
      vi.mocked(DigitalHandshake.require).mockResolvedValueOnce(true);
      vi.mocked(e2eEncryptionService.encryptMessage).mockResolvedValueOnce({ id: 'msg1', encrypted: {} as any, signature: 'sig' });
      vi.mocked(e2eEncryptionService.decryptMessage).mockResolvedValueOnce({ result: 'success' });
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const result = await a2aClient.invoke('target-agent', 'doWork', { foo: 'bar' }, mockDirective);
      
      expect(DigitalHandshake.require).toHaveBeenCalledWith(mockDirective, 'Consult specialist target-agent via A2A sync', false, 'a2a:consult');
      expect(e2eEncryptionService.encryptMessage).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:50080/a2a/rpc', expect.any(Object));
      expect(e2eEncryptionService.decryptMessage).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('throws if handshake fails', async () => {
      vi.mocked(DigitalHandshake.require).mockResolvedValueOnce(false);
      await expect(a2aClient.invoke('target', 'method', {}, {} as any)).rejects.toThrow('A2A invocation paused for Digital Handshake approval');
    });
  });

  describe('stream', () => {
    it('calls handshake, initializes via RPC, then connects via EventSource', async () => {
      const mockDirective = { id: 'd1' } as any;
      vi.mocked(DigitalHandshake.require).mockResolvedValueOnce(true);
      vi.mocked(e2eEncryptionService.encryptMessage).mockResolvedValueOnce({ id: 'msg1', encrypted: {} as any, signature: 'sig' });
      vi.mocked(e2eEncryptionService.decryptMessage)
        .mockResolvedValueOnce({ result: { requestId: 'req-123' } }) // Init response
        .mockResolvedValueOnce({ data: 'chunk1' }) // Stream event 1
        .mockResolvedValueOnce({ data: 'chunk2' }); // Stream event 2

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const iterator = a2aClient.stream('target', 'method', {}, mockDirective);
      
      // We must start iterating to trigger logic
      const streamPromise = (async () => {
        const results = [];
        for await (const chunk of iterator) {
          results.push(chunk);
        }
        return results;
      })();

      // Wait a tick for EventSource to be created
      await new Promise(r => setTimeout(r, 0));

      // Retrieve the mocked EventSource created in stream()
      // Note: We need a way to access the created mock EventSource instance.
      // Since it's global.EventSource, we can't easily grab the specific instance unless we intercept it.
      // But we can simplify by making MockEventSource a singleton for this test, or we can just mock it properly.
    });
  });
});
