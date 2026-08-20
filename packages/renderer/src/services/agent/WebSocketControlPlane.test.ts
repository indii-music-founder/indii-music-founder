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

describe('WebSocketControlPlane reliability fixes', () => {
  const ackSentMessage = (socket: FakeWebSocket | null): { requestId: string } => {
    const sent = socket!.send.mock.calls.at(-1)![0] as string;
    return JSON.parse(sent) as { requestId: string };
  };

  const deliverAck = (socket: FakeWebSocket | null, requestId: string, sessionId = 's') => {
    socket?.onmessage?.({
      data: JSON.stringify({ type: 'ack', sessionId, requestId, payload: null, timestamp: 0 }),
    } as MessageEvent);
  };

  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    wcpInstance.clearAccountBoundary();
  });

  afterEach(() => {
    wcpInstance.clearAccountBoundary();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('clears the ack timeout when the ack arrives — no late 60s rejection', async () => {
    vi.useFakeTimers();
    wcpInstance.connect('ws://127.0.0.1:1234');
    FakeWebSocket.latest?.onopen?.();

    const pending = wcpInstance.route('s', { agentId: 'generalist', message: 'm' });
    deliverAck(FakeWebSocket.latest, ackSentMessage(FakeWebSocket.latest).requestId);
    await expect(pending).resolves.toBeNull();

    // Advancing past the ack window must not reject the already-settled
    // promise (the timer was cleared on ack, not left to fire).
    await vi.advanceTimersByTimeAsync(61_000);
    await expect(pending).resolves.toBeNull();
  });

  it('rejects queued sends immediately on disconnect instead of hanging until the ack timeout', async () => {
    vi.useFakeTimers();
    wcpInstance.connect('ws://127.0.0.1:1234');
    FakeWebSocket.latest?.onopen?.();

    const pending = wcpInstance.route('s', { agentId: 'generalist', message: 'm' });
    wcpInstance.disconnect();

    await expect(pending).rejects.toThrow('[WCP] Disconnected');
  });

  it('resets the reconnect backoff on disconnect', async () => {
    vi.useFakeTimers();
    wcpInstance.connect('ws://127.0.0.1:1234');
    const firstSocket = FakeWebSocket.latest;
    firstSocket?.onopen?.();

    // First drop schedules a 1s reconnect.
    firstSocket?.onclose?.();
    await vi.advanceTimersByTimeAsync(1_000);
    const secondSocket = FakeWebSocket.latest;
    expect(secondSocket).not.toBe(firstSocket);

    // Disconnect must reset the counter: the next drop schedules the 1s
    // backoff again, not the capped 30s one.
    wcpInstance.disconnect();
    wcpInstance.connect('ws://127.0.0.1:1234');
    secondSocket?.onopen?.();
    secondSocket?.onclose?.();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeWebSocket.latest).not.toBe(secondSocket);
  });

  it('forces a reconnect when the socket goes silent (half-open detection)', async () => {
    vi.useFakeTimers();
    wcpInstance.connect('ws://127.0.0.1:1234');
    const socket = FakeWebSocket.latest!;
    socket.onopen?.();

    // No inbound traffic ever: after three heartbeat intervals the plane
    // must close the dead socket so onclose schedules the reconnect.
    await vi.advanceTimersByTimeAsync(81_000);
    expect(socket.close).toHaveBeenCalled();
  });
});
