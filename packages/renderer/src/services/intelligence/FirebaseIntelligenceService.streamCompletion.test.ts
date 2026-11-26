import { describe, expect, it, vi, afterEach } from 'vitest';
import { FirebaseIntelligenceService } from './FirebaseIntelligenceService';

describe('FirebaseIntelligenceService stream completion & abort handling (ISSUE-1688)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('settles immediately on { complete: true } without hanging when the underlying HTTP/2 stream never emits EOF', async () => {
    const encoder = new TextEncoder();
    const cancelSpy = vi.fn().mockResolvedValue(undefined);
    let readCount = 0;

    const hangingBody = {
      getReader: () => ({
        read: () => {
          readCount++;
          if (readCount === 1) {
            return Promise.resolve({
              done: false,
              value: encoder.encode(
                'data: {"text":"Saved to your project library."}\n' +
                'data: {"complete":true}\n',
              ),
            });
          }
          // Simulates a lingering HTTP/2 keep-alive connection that never closes on its own.
          return new Promise<ReadableStreamReadResult<Uint8Array>>(() => {});
        },
        cancel: cancelSpy,
      }),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: hangingBody,
      }),
    );

    const service = new FirebaseIntelligenceService();
    const callStream = (service as unknown as {
      callBackendGenerateContentStream: (
        contents: unknown[],
        modelName: string,
        config: Record<string, unknown>,
        costReservationId: string,
        headers: Record<string, string>,
        signal?: AbortSignal,
      ) => Promise<{ stream: ReadableStream<{ text: () => string }>; response: Promise<{ text: () => string }> }>;
    }).callBackendGenerateContentStream.bind(service);

    const startedAt = Date.now();
    const { stream, response } = await callStream(
      [{ role: 'user', parts: [{ text: 'Where is it saved?' }] }],
      'gemini-3-flash-preview',
      {},
      'res-1688',
      { 'Content-Type': 'application/json' },
    );

    const reader = stream.getReader();
    const collected: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(value.text());
    }
    const wrapped = await response;

    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(collected.join('')).toBe('Saved to your project library.');
    expect(wrapped.text()).toBe('Saved to your project library.');
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(readCount).toBe(1);
  });

  it('cancels the underlying reader immediately when the caller AbortSignal fires', async () => {
    const cancelSpy = vi.fn().mockResolvedValue(undefined);
    let rejectRead!: (err: unknown) => void;
    const hangingBody = {
      getReader: () => ({
        read: () => new Promise<ReadableStreamReadResult<Uint8Array>>((_res, rej) => {
          rejectRead = rej;
        }),
        cancel: vi.fn((reason?: unknown) => {
          cancelSpy(reason);
          rejectRead(new DOMException('Aborted', 'AbortError'));
          return Promise.resolve();
        }),
      }),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: hangingBody,
      }),
    );

    const controller = new AbortController();
    const service = new FirebaseIntelligenceService();
    const callStream = (service as unknown as {
      callBackendGenerateContentStream: (
        contents: unknown[],
        modelName: string,
        config: Record<string, unknown>,
        costReservationId: string,
        headers: Record<string, string>,
        signal?: AbortSignal,
      ) => Promise<{ stream: ReadableStream<unknown>; response: Promise<unknown> }>;
    }).callBackendGenerateContentStream.bind(service);

    const { response } = await callStream(
      [{ role: 'user', parts: [{ text: 'Follow up' }] }],
      'gemini-3-flash-preview',
      {},
      'res-1688-abort',
      { 'Content-Type': 'application/json' },
      controller.signal,
    );

    controller.abort('CANCELLED');
    await expect(response).rejects.toThrow();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});
