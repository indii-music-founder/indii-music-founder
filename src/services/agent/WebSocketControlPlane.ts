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
  private pendingAcks: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map();
  private listeners: Map<string, Set<(msg: WCPMessage) => void>> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnects = 5;
  private readonly heartbeatIntervalMs = 20_000;

  // ─── Connection ────────────────────────────────────────────────────────────

  connect(url: string = this._defaultUrl()): void {
    if (this.state === 'connected' || this.state === 'connecting') return;

    this.state = 'connecting';
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
      logger.info('[WCP] Connected');
      this._startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
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
      this._scheduleReconnect(url);
    };
  }

  disconnect(): void {
    this._stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.state = 'disconnected';
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
      this.pendingAcks.get(msg.requestId)!.resolve(msg.payload);
      this.pendingAcks.delete(msg.requestId);
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

      this.pendingAcks.set(msg.requestId, { resolve, reject });
      this._rawSend(msg);

      // Timeout if no ack after 60s
      setTimeout(() => {
        if (this.pendingAcks.has(msg.requestId)) {
          this.pendingAcks.delete(msg.requestId);
          reject(new Error(`[WCP] Timeout waiting for ack ${msg.requestId}`));
        }
      }, 60_000);
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
      if (this.state === 'connected') {
        const hb: WCPMessage = {
          type: 'heartbeat',
          sessionId: '__hb__',
          payload: null,
          timestamp: Date.now(),
          requestId: crypto.randomUUID(),
        };
        this._rawSend(hb);
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
    if (this.reconnectAttempts >= this.maxReconnects) {
      logger.warn('[WCP] Max reconnect attempts reached. Giving up.');
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;
    logger.info(`[WCP] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(url), delay);
  }

  private _defaultUrl(): string {
    return (
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WEBSOCKET_URL) ||
      'ws://localhost:1234'
    );
  }
}

export const wcpInstance = new WebSocketControlPlane();
