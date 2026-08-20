/**
 * WebSocket Control Plane
 *
 * Implements the Gateway Control Plane pattern: a centralized WebSocket router
 * that multiplexes inputs across indii Conductor and all 17+ specialist agents while
 * maintaining strict per-session namespaces and a command queue with locking to
 * prevent concurrent corruption.
 *
 * Architecture: Persistent session abstractions WITHOUT the
 * plain-text credential vulnerability — all auth is delegated to indii's
 * SHA256 token system and Firebase security rules.
 */

import { logger } from '@/utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WCPMessageType =
  | 'route'       // Route a user message to agent(s)
  | 'broadcast'   // Broadcast to all sessions
  | 'sync'        // Sync Zustand state slice to mobile peer
  | 'ack'         // Acknowledgement
  | 'error'       // Error from control plane
  | 'heartbeat';  // Keep-alive

export interface WCPMessage {
  type: WCPMessageType;
  sessionId: string;
  payload: unknown;
  timestamp: number;
  requestId: string; // UUID for deduplication / ack pairing
}

export interface WCPRoutingPayload {
  agentId: string;
  message: string;
  attachments?: { filename: string; base64: string }[];
  namespace?: string; // e.g. "cron:album-rollout" for background jobs
}

export interface SessionLock {
  sessionId: string;
  lockedAt: number;
  namespace: string;
}

export type WCPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// ─── Queue ────────────────────────────────────────────────────────────────────

interface QueueEntry {
  message: WCPMessage;
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
}

// ─── Control Plane ────────────────────────────────────────────────────────────

class WebSocketControlPlane {
  private ws: WebSocket | null = null;
  private state: WCPConnectionState = 'disconnected';
  private sessionLocks: Map<string, SessionLock> = new Map();
  private commandQueues: Map<string, QueueEntry[]> = new Map();
  private processingSet: Set<string> = new Set(); // sessions actively processing
  private pendingAcks: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }> = new Map();
  private listeners: Map<string, Set<(msg: WCPMessage) => void>> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private reconnectEnabled = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxReconnects = 5;
  private readonly heartbeatIntervalMs = 20_000;
  /** Any inbound traffic proves liveness; silence past this forces a close. */
  private lastInboundAt = 0;

  // ─── Connection ────────────────────────────────────────────────────────────

  connect(url: string = this._defaultUrl()): void {
    if (this.state === 'connected' || this.state === 'connecting') return;

    this.state = 'connecting';
    this.reconnectEnabled = true;
    logger.info('[WCP] Connecting to', url);

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.state = 'error';
      return;
    }

    this.ws.onopen = () => {
      this.state = 'connected';
      this.reconnectAttempts = 0;
      this.lastInboundAt = Date.now();
      logger.info('[WCP] Connected');
      this._startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.lastInboundAt = Date.now();
      try {
        const msg: WCPMessage = JSON.parse(event.data as string);
        this._dispatch(msg);
      } catch {
        logger.warn('[WCP] Unparseable message received');
      }
    };

    this.ws.onerror = (err) => {
      logger.error('[WCP] WebSocket error', err);
      this.state = 'error';
    };

    this.ws.onclose = () => {
      this._stopHeartbeat();
      this.state = 'disconnected';
      logger.info('[WCP] Disconnected');
      if (this.reconnectEnabled) this._scheduleReconnect(url);
    };
  }

  disconnect(reason = '[WCP] Disconnected'): void {
    this.reconnectEnabled = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._stopHeartbeat();
    const socket = this.ws;
    this.ws = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    }
    this.state = 'disconnected';
    // A clean disconnect is a full reset: the next connect() must start a
    // fresh backoff instead of inheriting a dead counter, and everything
    // waiting on this connection must fail now rather than hang until the
    // ack timeout.
    this.reconnectAttempts = 0;
    const connectionError = new Error(reason);
    this.commandQueues.forEach(queue => queue.splice(0).forEach(entry => entry.reject(connectionError)));
    this.pendingAcks.forEach(pending => {
      clearTimeout(pending.timer);
      pending.reject(connectionError);
    });
    this.commandQueues.clear();
    this.pendingAcks.clear();
    this.processingSet.clear();
  }

  clearAccountBoundary(): void {
    // disconnect(reason) rejects everything queued/pending with the boundary
    // message; the explicit rejections below are kept as a no-op safety net.
    this.disconnect('Authenticated account changed');
    const boundaryError = new Error('Authenticated account changed');
    this.commandQueues.forEach(queue => queue.splice(0).forEach(entry => entry.reject(boundaryError)));
    this.pendingAcks.forEach(pending => {
      clearTimeout(pending.timer);
      pending.reject(boundaryError);
    });
    this.commandQueues.clear();
    this.pendingAcks.clear();
    this.sessionLocks.clear();
    this.processingSet.clear();
    this.listeners.clear();
  }

  get connectionState(): WCPConnectionState {
    return this.state;
  }

  // ─── Routing ───────────────────────────────────────────────────────────────

  /**
   * Enqueue a message for a session. If the session is currently processing,
   * the message waits in queue — preventing concurrent corruption.
   */
  async send(message: WCPMessage): Promise<unknown> {
    const { sessionId } = message;

    return new Promise<unknown>((resolve, reject) => {
      const queue = this.commandQueues.get(sessionId) ?? [];
      queue.push({ message, resolve, reject });
      this.commandQueues.set(sessionId, queue);
      this._drainQueue(sessionId);
    });
  }

  /**
   * Convenience: route a message to a specific agent via the control plane.
   */
  async route(
    sessionId: string,
    payload: WCPRoutingPayload,
    namespace?: string
  ): Promise<unknown> {
    const msg: WCPMessage = {
      type: 'route',
      sessionId: namespace ? `${namespace}::${sessionId}` : sessionId,
      payload,
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
    };
    return this.send(msg);
  }

  /**
   * Broadcast a state sync to all connected mobile peers.
   */
  broadcast(stateSlice: Record<string, unknown>): void {
    if (this.state !== 'connected' || !this.ws) return;

    const msg: WCPMessage = {
      type: 'broadcast',
      sessionId: '__global__',
      payload: stateSlice,
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
    };
    this._rawSend(msg);
  }

  // ─── Session Namespace & Locking ───────────────────────────────────────────

  /**
   * Acquire a named lock for a session namespace (e.g., background Inngest job).
   * Returns false if already locked by a different namespace.
   */
  acquireLock(sessionId: string, namespace: string): boolean {
    const existing = this.sessionLocks.get(sessionId);
    if (existing && existing.namespace !== namespace) {
      logger.warn(`[WCP] Session ${sessionId} locked by '${existing.namespace}', rejecting '${namespace}'`);
      return false;
    }
    this.sessionLocks.set(sessionId, { sessionId, namespace, lockedAt: Date.now() });
    return true;
  }

  releaseLock(sessionId: string): void {
    this.sessionLocks.delete(sessionId);
  }

  isLocked(sessionId: string): boolean {
    return this.sessionLocks.has(sessionId);
  }

  getLock(sessionId: string): SessionLock | undefined {
    return this.sessionLocks.get(sessionId);
  }

  // ─── Event Subscription ────────────────────────────────────────────────────

  on(eventType: WCPMessageType, listener: (msg: WCPMessage) => void): () => void {
    const set = this.listeners.get(eventType) ?? new Set();
    set.add(listener);
    this.listeners.set(eventType, set);
    return () => set.delete(listener);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private _dispatch(msg: WCPMessage): void {
    // Resolve pending acks
    if (msg.type === 'ack' && this.pendingAcks.has(msg.requestId)) {
      const pending = this.pendingAcks.get(msg.requestId)!;
      clearTimeout(pending.timer);
      this.pendingAcks.delete(msg.requestId);
      pending.resolve(msg.payload);
    }

    // Fan out to type listeners
    this.listeners.get(msg.type)?.forEach(fn => fn(msg));

    // Drain the session queue after each inbound message
    this._drainQueue(msg.sessionId);

    // Also drain compound-keyed queues (namespace::sessionId → sessionId)
    // The server may echo only the bare sessionId while our queue key includes the namespace prefix
    for (const key of this.commandQueues.keys()) {
      if (key !== msg.sessionId && key.endsWith(`::${msg.sessionId}`)) {
        this._drainQueue(key);
      }
    }
  }

  private async _drainQueue(sessionId: string): Promise<void> {
    if (this.processingSet.has(sessionId)) return;

    const queue = this.commandQueues.get(sessionId) ?? [];
    if (queue.length === 0) return;

    this.processingSet.add(sessionId);

    try {
      while (queue.length > 0) {
        const entry = queue.shift()!;
        try {
          const result = await this._dispatchEntry(entry.message);
          entry.resolve(result);
        } catch (err: unknown) {
          entry.reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
    } finally {
      this.processingSet.delete(sessionId);
    }
  }

  private _dispatchEntry(msg: WCPMessage): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      if (this.state !== 'connected' || !this.ws) {
        reject(new Error('[WCP] Not connected'));
        return;
      }

      const timer = setTimeout(() => {
        if (this.pendingAcks.has(msg.requestId)) {
          this.pendingAcks.delete(msg.requestId);
          reject(new Error(`[WCP] Timeout waiting for ack ${msg.requestId}`));
        }
      }, 60_000);

      this.pendingAcks.set(msg.requestId, { resolve, reject, timer });
      this._rawSend(msg);
    });
  }

  private _rawSend(msg: WCPMessage): void {
    try {
      this.ws?.send(JSON.stringify(msg));
    } catch (err: unknown) {
      logger.error('[WCP] Send error', err);
    }
  }

  private _startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'connected' && this.ws) {
        const hb: WCPMessage = {
          type: 'heartbeat',
          sessionId: '__hb__',
          payload: null,
          timestamp: Date.now(),
          requestId: crypto.randomUUID(),
        };
        // Route the heartbeat through the ack machinery: the server's ack is
        // inbound traffic that proves liveness. An unacked heartbeat rejects
        // here (bounded: at most ~3 pending timers at 20s/60s) and the
        // silence check below forces the reconnect.
        this._dispatchEntry(hb).catch(() => {
          logger.warn(`[WCP] Heartbeat ${hb.requestId} went unacknowledged.`);
        });

        // Liveness: a half-open TCP socket (peer gone, no FIN/RST) would
        // otherwise stay 'connected' forever and every send() would hang
        // until the ack timeout. Silence past three intervals means the
        // socket is dead — force the close so onclose reconnects.
        if (Date.now() - this.lastInboundAt > 3 * this.heartbeatIntervalMs) {
          logger.warn(`[WCP] No inbound traffic for ${(Date.now() - this.lastInboundAt) / 1000}s — forcing reconnect.`);
          this.ws.close();
        }
      }
    }, this.heartbeatIntervalMs);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private _scheduleReconnect(url: string): void {
    // Capped exponential backoff that never silently gives up: once the
    // initial budget is exhausted the plane keeps retrying at the cap
    // (30s) while reconnectEnabled is true — the old code stopped
    // scheduling entirely after maxReconnects, leaving the plane dead
    // with no recovery path until a fresh connect().
    const attempts = this.reconnectAttempts;
    const delay = Math.min(1000 * 2 ** attempts, 30_000);
    this.reconnectAttempts++;
    if (attempts >= this.maxReconnects) {
      logger.warn(`[WCP] Reconnect attempt ${attempts + 1} — keeping retry at capped interval`);
    } else {
      logger.info(`[WCP] Reconnecting in ${delay}ms (attempt ${attempts + 1})`);
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.reconnectEnabled) this.connect(url);
    }, delay);
  }

  private _defaultUrl(): string {
    return import.meta.env.VITE_WEBSOCKET_URL || 'ws://127.0.0.1:1234';
  }
}

export const wcpInstance = new WebSocketControlPlane();
