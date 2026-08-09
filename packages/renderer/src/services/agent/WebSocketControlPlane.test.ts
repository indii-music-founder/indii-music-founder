import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wcpInstance } from './WebSocketControlPlane';

class FakeWebSocket {
  static latest: FakeWebSocket | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(_url: string) {
    FakeWebSocket.latest = this;
  }
}

describe('WebSocketControlPlane account boundary', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    wcpInstance.clearAccountBoundary();
  });

  afterEach(() => {
    wcpInstance.clearAccountBoundary();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('rejects queued account work and closes without reconnecting', async () => {
    wcpInstance.connect('ws://127.0.0.1:1234');
    FakeWebSocket.latest?.onopen?.();
    const pending = wcpInstance.route('session-a', { agentId: 'generalist', message: 'private request' });

    wcpInstance.clearAccountBoundary();

    await expect(pending).rejects.toThrow('Authenticated account changed');
    expect(FakeWebSocket.latest?.close).toHaveBeenCalledOnce();
    expect(wcpInstance.connectionState).toBe('disconnected');
  });
});
