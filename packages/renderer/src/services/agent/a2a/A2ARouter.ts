import { MessageEnvelope, e2eEncryptionService } from '@/services/security/E2EEncryptionService';
import { CARD_REGISTRY } from './CardRegistry';
import { AgentCardSchema } from './AgentCard.schema';
import { VALID_AGENT_IDS, validateHubAndSpoke } from '../types';
import { RouterCallContext } from './transport/A2ATransport';
import { logger } from '@/utils/logger';
import { MY_AGENT_ID } from './A2AConfig';

/**
 * Thrown when the router cannot produce an encrypted response (e.g. the sender's
 * public key was never registered). The client maps this to a tool error rather
 * than receiving a malformed envelope.
 */
export class A2ARouterEncryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'A2ARouterEncryptError';
  }
}

/**
 * A2A Router — the in-process JSON-RPC dispatcher for agent-to-agent calls.
 *
 * Key model (single router identity):
 *   - The router owns ONE identity: MY_AGENT_ID. It decrypts every request
 *     addressed to it, and encrypts every response back to the *sender's*
 *     registered public key (the caller exchanged it during discover()).
 *   - The `targetAgentId` travels INSIDE the encrypted JSON-RPC params; it is
 *     NOT used as the crypto recipient. This is what makes the loopback E2E
 *     round-trip genuinely correct rather than relying on throwaway keypairs.
 */
class A2ARouter {
  private streamGenerators = new Map<string, AsyncIterable<MessageEnvelope>>();
  private streamSenders = new Map<string, string>();
  private routerInitialized = false;

  /**
   * Ensure the router has initialized its own keypair (MY_AGENT_ID).
   */
  async ensureRouterKey(): Promise<void> {
    if (this.routerInitialized) return;
    await e2eEncryptionService.initialize(MY_AGENT_ID);
    this.routerInitialized = true;
  }

  /**
   * Handle an encrypted JSON-RPC envelope.
   * Decrypt (as MY_AGENT_ID) → dispatch → encrypt response (to sender).
   */
  async handleEncrypted(envelope: MessageEnvelope, localCtx?: RouterCallContext): Promise<MessageEnvelope> {
    await this.ensureRouterKey();

    // Decrypt the envelope as the router identity
    let decrypted: Record<string, unknown>;
    try {
      decrypted = await e2eEncryptionService.decryptMessage(envelope, MY_AGENT_ID);
    } catch (e) {
      logger.error('[A2ARouter] Decryption failed:', e);
      // We cannot encrypt a reply if we couldn't even decrypt the request,
      // so surface a typed error the client maps to a tool error.
      throw new A2ARouterEncryptError('A2A request could not be decrypted');
    }

    const { jsonrpc, method, params, id } = decrypted as {
      jsonrpc?: string;
      method?: string;
      params?: Record<string, unknown>;
      id?: string | number;
    };

    // The sender is the party we encrypt the reply back to. It must be present
    // and have an exchanged public key (registered during discover()).
    const senderId = (params?.senderId as string) || (decrypted.senderId as string) || '';
    if (!senderId) {
      // Invalid params — but we have no key to encrypt an error back to.
      throw new A2ARouterEncryptError('A2A request missing senderId (no reply channel)');
    }

    let responsePayload: Record<string, unknown>;

    if (jsonrpc !== '2.0') {
      responsePayload = { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request: jsonrpc must be 2.0' }, id };
    } else {
      try {
        let result: unknown;
        if (method === 'agent.execute') {
          result = await this.dispatchAgentExecute(params, localCtx, senderId);
        } else if (method === 'stream.init') {
          result = await this.dispatchStreamInit(params, localCtx, senderId);
        } else if (method === 'stream.cancel') {
          result = await this.dispatchStreamCancel(params);
        } else {
          responsePayload = { jsonrpc: '2.0', error: { code: -32601, message: `Method not found: ${method}` }, id };
          return this.encryptReply(responsePayload, senderId);
        }
        responsePayload = { jsonrpc: '2.0', result, id };
      } catch (e) {
        logger.error(`[A2ARouter] Dispatch error for ${method}:`, e);
        const msg = e instanceof Error ? e.message : String(e);
        // Map known validation failures to JSON-RPC invalid-params (-32602),
        // everything else to internal error (-32603).
        const code = /Invalid agent ID|Hub-and-spoke/.test(msg) ? -32602 : -32603;
        responsePayload = { jsonrpc: '2.0', error: { code, message: msg }, id };
      }
    }

    return this.encryptReply(responsePayload, senderId);
  }

  /**
   * Encrypt a JSON-RPC response payload back to the sender. Throws a typed
   * error (never returns a malformed envelope) if encryption is impossible.
   */
  private async encryptReply(payload: Record<string, unknown>, senderId: string): Promise<MessageEnvelope> {
    try {
      return await e2eEncryptionService.encryptMessage(payload, senderId, MY_AGENT_ID);
    } catch (e) {
      logger.error('[A2ARouter] Failed to encrypt reply:', e);
      throw new A2ARouterEncryptError(`Failed to encrypt reply to ${senderId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Handle plaintext JSON-RPC (used for discovery, key.exchange).
   */
  async handlePlain(payload: { method?: string; params?: Record<string, unknown>; id?: string | number }): Promise<unknown> {
    try {
      await this.ensureRouterKey();

      const { method, params, id } = payload;

      if (method === 'key.exchange') {
        const senderId = params?.senderId as string;
        const publicKeyJwk = params?.publicKeyJwk as JsonWebKey;
        if (!senderId || !publicKeyJwk) {
          return { jsonrpc: '2.0', error: { code: -32602, message: 'key.exchange requires senderId and publicKeyJwk' }, id };
        }
        await e2eEncryptionService.registerPeerPublicKey(senderId, publicKeyJwk);
        logger.info(`[A2ARouter] Key exchange registered for ${senderId}`);
        return { jsonrpc: '2.0', result: { success: true }, id };
      }

      return { jsonrpc: '2.0', error: { code: -32601, message: `Unknown plaintext method: ${method}` }, id };
    } catch (e) {
      logger.error('[A2ARouter] Error in handlePlain:', e);
      return { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: payload.id };
    }
  }

  /**
   * Build the discovery document. Each AgentCard is published with the router's
   * public key as the swarm endpoint key (single-router-identity model) — every
   * agent.execute request is decrypted by the router, not by a per-agent key.
   */
  async buildDiscovery(): Promise<unknown[]> {
    await this.ensureRouterKey();
    const routerPublicKey = await e2eEncryptionService.exportPublicKey(MY_AGENT_ID);
    const cards: unknown[] = [];

    for (const [agentId, card] of Object.entries(CARD_REGISTRY)) {
      try {
        const enrichedCard = { ...card, publicKeyJwk: routerPublicKey };
        AgentCardSchema.parse(enrichedCard); // Zod validation
        cards.push(enrichedCard);
      } catch (e) {
        logger.warn(`[A2ARouter] Failed to enrich card for ${agentId}:`, e);
      }
    }

    return cards;
  }

  /**
   * Dispatch `agent.execute` — run the target agent via localCtx.runAgent.
   */
  private async dispatchAgentExecute(
    params: Record<string, unknown> | undefined,
    localCtx: RouterCallContext | undefined,
    _senderId: string
  ): Promise<unknown> {
    const targetAgentId = params?.targetAgentId as string;
    const task = params?.task as string;
    // The REAL calling agent (e.g. 'generalist'), NOT the crypto reply channel.
    // Falls back to the hub so a missing source doesn't over-restrict.
    const sourceAgentId = (params?.sourceAgentId as string) || 'generalist';

    if (!VALID_AGENT_IDS.includes(targetAgentId as never)) {
      throw new Error(`Invalid agent ID: ${targetAgentId}`);
    }

    const hubSpokeError = validateHubAndSpoke(sourceAgentId as never, targetAgentId as never);
    if (hubSpokeError) {
      throw new Error(`Hub-and-spoke violation: ${hubSpokeError}`);
    }

    if (!localCtx?.runAgent) {
      throw new Error('No runAgent available in router context');
    }

    const result = await localCtx.runAgent(targetAgentId, task, localCtx.parentContext, localCtx.traceId);
    return { text: result?.text || String(result), agentId: targetAgentId };
  }

  /**
   * Dispatch `stream.init` — allocate a requestId and register a batch generator.
   */
  private async dispatchStreamInit(
    params: Record<string, unknown> | undefined,
    localCtx: RouterCallContext | undefined,
    senderId: string
  ): Promise<unknown> {
    const targetAgentId = params?.targetAgentId as string;
    const task = params?.task as string;
    const sourceAgentId = (params?.sourceAgentId as string) || 'generalist';

    if (!VALID_AGENT_IDS.includes(targetAgentId as never)) {
      throw new Error(`Invalid agent ID: ${targetAgentId}`);
    }

    const hubSpokeError = validateHubAndSpoke(sourceAgentId as never, targetAgentId as never);
    if (hubSpokeError) {
      throw new Error(`Hub-and-spoke violation: ${hubSpokeError}`);
    }

    if (!localCtx?.runAgent) {
      throw new Error('No runAgent available');
    }

    const requestId = crypto.randomUUID();
    // Encrypt stream chunks back to the actual caller (not a hardcoded id).
    const generator = this.createBatchGenerator(targetAgentId, task, localCtx, senderId);
    this.streamGenerators.set(requestId, generator);
    this.streamSenders.set(requestId, senderId);

    logger.info(`[A2ARouter] Stream initialized for ${targetAgentId}: ${requestId}`);
    return { requestId };
  }

  /**
   * Run the target agent to completion and yield its result once.
   *
   * NOTE: This is BATCH, not token-by-token streaming. It runs the agent fully,
   * then yields a single encrypted envelope. True SSE token streaming is a
   * separate future effort. Named "batch" so no one mistakes it for live tokens.
   */
  private async *createBatchGenerator(
    targetAgentId: string,
    task: string,
    localCtx: RouterCallContext,
    recipientId: string
  ): AsyncIterable<MessageEnvelope> {
    try {
      const result = await localCtx.runAgent(targetAgentId, task, localCtx.parentContext, localCtx.traceId);
      const message = { text: result?.text || String(result), agentId: targetAgentId };

      await this.ensureRouterKey();
      const envelope = await e2eEncryptionService.encryptMessage(message, recipientId, MY_AGENT_ID);
      yield envelope;
    } catch (e) {
      logger.error('[A2ARouter] Error in batch generator:', e);
    }
  }

  /**
   * Get a registered stream generator (called by LoopbackA2ATransport.openStream).
   */
  getStreamGenerator(requestId: string): AsyncIterable<MessageEnvelope> | undefined {
    return this.streamGenerators.get(requestId);
  }

  /**
   * Cancel a stream.
   */
  private async dispatchStreamCancel(params: Record<string, unknown> | undefined): Promise<unknown> {
    const requestId = params?.requestId as string;
    this.streamGenerators.delete(requestId);
    this.streamSenders.delete(requestId);
    return { success: true };
  }
}

export const a2aRouter = new A2ARouter();
