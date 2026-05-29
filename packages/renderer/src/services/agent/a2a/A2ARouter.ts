import { MessageEnvelope, e2eEncryptionService } from '@/services/security/E2EEncryptionService';
import { CARD_REGISTRY } from './CardRegistry';
import { AgentCardSchema } from './AgentCard.schema';
import { VALID_AGENT_IDS, validateHubAndSpoke } from '../types';
import { RouterCallContext } from './transport/A2ATransport';
import { logger } from '@/utils/logger';
import { MY_AGENT_ID } from './A2AConfig';

/**
 * A2A Router — the in-process JSON-RPC dispatcher for agent-to-agent calls.
 * Receives encrypted JSON-RPC envelopes, decrypts, dispatches methods, and returns encrypted responses.
 */
class A2ARouter {
  private agentKeys = new Map<string, { initialized: boolean }>();
  private streamGenerators = new Map<string, AsyncIterable<MessageEnvelope>>();
  private routerInitialized = false;

  /**
   * Ensure router has initialized its keypair.
   */
  async ensureRouterKey(): Promise<void> {
    if (this.routerInitialized) return;
    await e2eEncryptionService.initialize(MY_AGENT_ID);
    this.routerInitialized = true;
  }

  /**
   * Ensure target agent has a keypair (encrypted responses will use it).
   */
  private async ensureAgentKey(agentId: string): Promise<void> {
    if (this.agentKeys.has(agentId)) return;
    try {
      await e2eEncryptionService.initialize(agentId);
      this.agentKeys.set(agentId, { initialized: true });
    } catch (e) {
      logger.warn(`[A2ARouter] Failed to initialize key for ${agentId}: ${e}`);
    }
  }

  /**
   * Handle an encrypted JSON-RPC envelope.
   * Decrypt → dispatch → encrypt response.
   */
  async handleEncrypted(envelope: MessageEnvelope, localCtx?: RouterCallContext): Promise<MessageEnvelope> {
    try {
      await this.ensureRouterKey();

      // Decrypt the envelope
      let decrypted: any;
      try {
        decrypted = await e2eEncryptionService.decryptMessage(envelope, MY_AGENT_ID);
      } catch (e) {
        logger.error('[A2ARouter] Decryption failed:', e);
        return this.errorResponse(-32700, 'Parse error: decryption failed', envelope.id);
      }

      if ('error' in decrypted) {
        return this.errorResponse(-32700, 'Parse error: decrypted message is an error', envelope.id);
      }

      const { jsonrpc, method, params, id } = decrypted;
      if (jsonrpc !== '2.0') {
        return this.errorResponse(-32600, 'Invalid Request: jsonrpc must be 2.0', id);
      }

      // Extract senderId from envelope metadata (or params)
      const senderId = (params?.senderId || decrypted.senderId || 'unknown') as string;

      // Dispatch the method
      let result: any;
      try {
        if (method === 'agent.execute') {
          result = await this.dispatchAgentExecute(params, localCtx, senderId);
        } else if (method === 'stream.init') {
          result = await this.dispatchStreamInit(params, localCtx, senderId);
        } else if (method === 'stream.cancel') {
          result = await this.dispatchStreamCancel(params);
        } else {
          return this.errorResponse(-32601, `Method not found: ${method}`, id);
        }
      } catch (e) {
        logger.error(`[A2ARouter] Dispatch error for ${method}:`, e);
        const msg = e instanceof Error ? e.message : String(e);
        return this.errorResponse(-32603, `Internal error: ${msg}`, id);
      }

      // Encrypt the response back to the sender
      const responsePayload = {
        jsonrpc: '2.0',
        result,
        id,
      };

      try {
        await this.ensureAgentKey(senderId);
        const responseEnvelope = await e2eEncryptionService.encryptMessage(
          responsePayload,
          senderId, // encrypt to sender's public key
          MY_AGENT_ID
        );
        return responseEnvelope;
      } catch (e) {
        logger.error('[A2ARouter] Failed to encrypt response:', e);
        // Return unencrypted error as fallback
        return {
          id: envelope.id,
          encrypted: false,
          error: { code: -32603, message: 'Internal error: failed to encrypt response' },
        } as any;
      }
    } catch (e) {
      logger.error('[A2ARouter] Unexpected error in handleEncrypted:', e);
      return {
        id: envelope.id,
        encrypted: false,
        error: { code: -32603, message: 'Internal server error' },
      } as any;
    }
  }

  /**
   * Handle plaintext JSON-RPC (used for discovery, key.exchange).
   */
  async handlePlain(payload: any): Promise<any> {
    try {
      await this.ensureRouterKey();

      const { method, params, id } = payload;

      if (method === 'key.exchange') {
        const { senderId, publicKeyJwk } = params;
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
   * Build the discovery document with all agent cards + their public keys.
   */
  async buildDiscovery(): Promise<any[]> {
    await this.ensureRouterKey();
    const cards = [];

    for (const [agentId, card] of Object.entries(CARD_REGISTRY)) {
      try {
        await this.ensureAgentKey(agentId);
        const publicKeyJwk = await e2eEncryptionService.exportPublicKey(agentId);
        const enrichedCard = { ...card, publicKeyJwk };
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
    params: any,
    localCtx: RouterCallContext | undefined,
    senderId: string
  ): Promise<any> {
    const { targetAgentId, task, sharedContext } = params;

    // Validate agent ID
    if (!VALID_AGENT_IDS.includes(targetAgentId)) {
      throw new Error(`Invalid agent ID: ${targetAgentId}`);
    }

    // Validate hub-and-spoke
    const hubSpokeError = validateHubAndSpoke(senderId, targetAgentId);
    if (hubSpokeError) {
      throw new Error(`Hub-and-spoke violation: ${hubSpokeError}`);
    }

    // Run the agent
    if (!localCtx?.runAgent) {
      throw new Error('No runAgent available in router context');
    }

    const result = await localCtx.runAgent(targetAgentId, task, localCtx.parentContext, localCtx.traceId);
    return { text: result?.text || String(result), agentId: targetAgentId };
  }

  /**
   * Dispatch `stream.init` — allocate a requestId and register a streaming generator.
   */
  private async dispatchStreamInit(params: any, localCtx: RouterCallContext | undefined, senderId: string): Promise<any> {
    const { targetAgentId, targetMethod, task, sharedContext } = params;

    // Validate
    if (!VALID_AGENT_IDS.includes(targetAgentId)) {
      throw new Error(`Invalid agent ID: ${targetAgentId}`);
    }

    const hubSpokeError = validateHubAndSpoke(senderId, targetAgentId);
    if (hubSpokeError) {
      throw new Error(`Hub-and-spoke violation: ${hubSpokeError}`);
    }

    if (!localCtx?.runAgent) {
      throw new Error('No runAgent available');
    }

    // Allocate requestId and start the streaming generator
    const requestId = crypto.randomUUID();
    const generator = this.createStreamingGenerator(targetAgentId, task, localCtx);
    this.streamGenerators.set(requestId, generator);

    logger.info(`[A2ARouter] Stream initialized for ${targetAgentId}: ${requestId}`);
    return { requestId };
  }

  /**
   * Create an async generator that yields encrypted responses as they arrive.
   * This will be consumed by LoopbackA2ATransport.openStream.
   */
  private async *createStreamingGenerator(
    targetAgentId: string,
    task: string,
    localCtx: RouterCallContext
  ): AsyncIterable<MessageEnvelope> {
    try {
      // For now, just run the agent and yield the result once.
      // In a future version, this could hook into streaming LLM responses.
      const result = await localCtx.runAgent(targetAgentId, task, localCtx.parentContext, localCtx.traceId);
      const message = { text: result?.text || String(result), agentId: targetAgentId };

      // Encrypt and yield
      await this.ensureRouterKey();
      const envelope = await e2eEncryptionService.encryptMessage(message, 'indii-conductor', MY_AGENT_ID);
      yield envelope;
    } catch (e) {
      logger.error('[A2ARouter] Error in streaming generator:', e);
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
  private async dispatchStreamCancel(params: any): Promise<any> {
    const { requestId } = params;
    this.streamGenerators.delete(requestId);
    return { success: true };
  }

  /**
   * Helper to create an error response.
   */
  private errorResponse(code: number, message: string, id?: string | number): MessageEnvelope {
    return {
      id: crypto.randomUUID(),
      encrypted: false,
      error: { code, message },
    } as any;
  }
}

export const a2aRouter = new A2ARouter();
