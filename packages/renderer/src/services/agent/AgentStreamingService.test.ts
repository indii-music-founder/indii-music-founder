import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AgentStreamingService } from './AgentStreamingService';

vi.mock('@/utils/dynamicImport', () => ({
  importWithRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

vi.mock('@/services/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-firebase-id-token'),
    },
  },
  appCheck: {},
}));

vi.mock('firebase/app-check', () => ({
  getToken: vi.fn().mockResolvedValue({ token: 'mock-app-check-token' }),
}));

vi.mock('@/core/config/EndpointService', () => ({
  endpointService: {
    getFunctionUrl: vi.fn(() => 'https://us-central1-test.cloudfunctions.net/agentStreamResponse'),
  },
}));

describe('AgentStreamingService', () => {
  let service: AgentStreamingService;

  beforeEach(() => {
    service = new AgentStreamingService();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    service.reset();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('connects via HTTP POST with Authorization and AppCheck headers, delivering tokens', async () => {
    const ssePayload = [
      'data: {"token":"Hello","index":0,"timestamp":100}\n\n',
      'data: {"token":" world","index":1,"timestamp":200}\n\n',
      'data: {"complete":true,"totalTokens":2}\n\n',
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const tokensReceived: string[] = [];
    let completedMetadata: unknown = null;

    await service.stream(
      'Write a chorus',
      'agent-songwriter',
      'user-456',
      { tempo: 120 },
      {
        onToken: (tok) => tokensReceived.push(tok),
        onComplete: (meta) => {
          completedMetadata = meta;
        },
      }
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://us-central1-test.cloudfunctions.net/agentStreamResponse',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-firebase-id-token',
          'X-Firebase-AppCheck': 'mock-app-check-token',
        }),
        body: JSON.stringify({
          userId: 'user-456',
          agentId: 'agent-songwriter',
          input: 'Write a chorus',
          context: { tempo: 120 },
        }),
      })
    );

    expect(tokensReceived).toEqual(['Hello', ' world']);
    expect(completedMetadata).toMatchObject({
      totalTokens: 2,
    });
    expect(service.getState().isStreaming).toBe(false);
  });

  it('stops and aborts an in-flight stream cleanly', async () => {
    let aborted = false;
    vi.mocked(fetch).mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          aborted = true;
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        });
      });
    });

    const streamPromise = service.stream('Infinite task', 'agent-1', 'user-1');
    expect(service.getState().isStreaming).toBe(true);

    // Give microtasks a turn to run so fetch is initiated
    await new Promise((resolve) => setTimeout(resolve, 0));

    service.stop();
    expect(service.getState().isStreaming).toBe(false);
    expect(aborted).toBe(true);

    await streamPromise;
  });

  it('propagates server errors to onError callback and fails fast on 4xx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Forbidden: Verify your email before using AI generation.', {
        status: 403,
      })
    );

    let caughtError: Error | null = null;
    await service.stream('Task', 'agent-1', 'user-1', undefined, {
      onError: (err) => {
        caughtError = err;
      },
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain('403');
    expect(service.getState().isStreaming).toBe(false);
  });
});
