/**
 * Agent-to-Agent Session Tools
 *
 * Implements inter-agent coordination primitives natively
 * within indiiOS's 3-layer architecture. Specialist agents (legal, finance, music,
 * etc.) can discover, message, and spawn sibling sessions without going through
 * a third-party broker.
 *
 * Tools:
 *   sessions_list    — List all active sessions visible to this agent
 *   sessions_send    — Send a message to a specific session (async, queued)
 *   sessions_history — Retrieve message history for a session
 *   sessions_spawn   — Spawn a new isolated session namespace for background work
 *
 * Security: All operations are scoped to the authenticated user's org.
 * Cross-org delegation is blocked at the Firestore security rules layer.
 */

import { logger } from '@/utils/logger';
import { wcpInstance } from './WebSocketControlPlane';
import type { ConversationSession, AgentMessage } from '@/core/store/slices/agent';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  title: string;
  participants: string[];
  namespace?: string;
  messageCount: number;
  updatedAt: number;
  isBackground: boolean; // true if spawned as a background namespace
}

export interface SpawnOptions {
  title: string;
  namespace: string; // e.g. "cron:album-rollout", "bg:legal-review"
  agents: string[];  // Agent IDs to involve
  initialMessage?: string;
}

export interface SessionToolResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Sessions List ────────────────────────────────────────────────────────────

/**
 * List all active sessions the calling agent has visibility into.
 * Background (namespaced) sessions are included with `isBackground: true`.
 */
export function sessions_list(
  sessions: Record<string, ConversationSession>
): SessionToolResult<SessionSummary[]> {
  try {
    const summaries: SessionSummary[] = Object.values(sessions)
      .filter(s => !s.isArchived)
      .map(s => ({
        id: s.id,
        title: s.title,
        participants: s.participants,
        namespace: s.namespace,
        messageCount: s.messages.length,
        updatedAt: s.updatedAt,
        isBackground: !!s.namespace,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    return { success: true, data: summaries };
  } catch (err: unknown) {
    logger.error('[SessionTools] sessions_list error', err);
    return { success: false, error: String(err) };
  }
}

// ─── Sessions Send ────────────────────────────────────────────────────────────

/**
 * Route a message from one agent to a specific session via the WebSocket
 * Control Plane's command queue (guarantees ordering and prevents corruption).
 */
export async function sessions_send(
  targetSessionId: string,
  fromAgentId: string,
  message: string,
  namespace?: string
): Promise<SessionToolResult<{ queued: boolean; requestId: string }>> {
  try {
    const requestId = crypto.randomUUID();

    // Acquire lock if namespace is provided (background job isolation)
    if (namespace) {
      const acquired = wcpInstance.acquireLock(targetSessionId, namespace);
      if (!acquired) {
        const lock = wcpInstance.getLock(targetSessionId);
        return {
          success: false,
          error: `Session ${targetSessionId} is locked by namespace '${lock?.namespace}'. Cannot inject from '${namespace}'.`,
        };
      }
    }

    try {
      await wcpInstance.route(
        targetSessionId,
        { agentId: fromAgentId, message, namespace },
        namespace
      );

      return { success: true, data: { queued: true, requestId } };
    } finally {
      // Always release the lock to prevent deadlocks
      if (namespace) {
        wcpInstance.releaseLock(targetSessionId);
      }
    }
  } catch (err: unknown) {
    logger.error('[SessionTools] sessions_send error', err);
    return { success: false, error: String(err) };
  }
}

// ─── Sessions History ─────────────────────────────────────────────────────────

/**
 * Retrieve message history for a session.
 * Supports pagination via `limit` and `beforeTs` (timestamp cursor).
 */
export function sessions_history(
  sessions: Record<string, ConversationSession>,
  sessionId: string,
  options: { limit?: number; beforeTs?: number } = {}
): SessionToolResult<AgentMessage[]> {
  try {
    const session = sessions[sessionId];
    if (!session) {
      return { success: false, error: `Session '${sessionId}' not found.` };
    }

    let msgs = [...session.messages];

    if (options.beforeTs) {
      msgs = msgs.filter(m => m.timestamp < options.beforeTs!);
    }

    msgs = msgs.sort((a, b) => a.timestamp - b.timestamp);

    if (options.limit) {
      msgs = msgs.slice(-options.limit);
    }

    return { success: true, data: msgs };
  } catch (err: unknown) {
    logger.error('[SessionTools] sessions_history error', err);
    return { success: false, error: String(err) };
  }
}

// ─── Sessions Spawn ───────────────────────────────────────────────────────────

/**
 * Spawn a new isolated background session with a unique namespace.
 * Namespaced sessions never contaminate the main user UI thread.
 *
 * The spawned session is registered in the Zustand store and persisted to
 * Firestore via SessionService. The WCP acquires a lock so only this namespace
 * can write to the session until explicitly released.
 *
 * Returns the new session ID for downstream use.
 */
export async function sessions_spawn(
  options: SpawnOptions,
  createSession: (title?: string, initialAgents?: string[], namespace?: string) => string,
  addMessage?: (msg: AgentMessage) => void
): Promise<SessionToolResult<{ sessionId: string; namespace: string }>> {
  try {
    const { title, namespace, agents, initialMessage } = options;

    // Validate namespace format: "prefix:label"
    if (!namespace.includes(':')) {
      return {
        success: false,
        error: `Invalid namespace format '${namespace}'. Use 'prefix:label' (e.g. 'cron:album-rollout').`,
      };
    }

    // Create the session
    const sessionId = createSession(title, agents, namespace);

    // Acquire WCP lock for this namespace
    wcpInstance.acquireLock(sessionId, namespace);

    // Optionally seed with initial message
    if (initialMessage && addMessage) {
      const seedMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        text: `[Spawned by namespace: ${namespace}] ${initialMessage}`,
        timestamp: Date.now(),
        agentId: agents[0] ?? 'system',
      };
      addMessage(seedMsg);
    }

    logger.info(`[SessionTools] Spawned session ${sessionId} with namespace '${namespace}'`);

    return { success: true, data: { sessionId, namespace } };
  } catch (err: unknown) {
    logger.error('[SessionTools] sessions_spawn error', err);
    return { success: false, error: String(err) };
  }
}
